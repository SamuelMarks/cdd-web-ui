#!/usr/bin/env node
/**
 * @file Centralized background process supervisor, log multiplexer, and port/process
 * cleanup utility for `serve_backend_and_frontend` and `unserve_backend_and_frontend`.
 * Runs `cargo run` in `../cdd-storage`, `../cdd-control-plane`, `../cdd-publisher`,
 * and `../cdd-gateway` in the background alongside `serve_local` (`cdd-web-ui`),
 * streaming all stdout and stderr lines with color-coded service prefixes into one
 * unified log stream, and can forcefully terminate all dangling processes and free ports.
 * @module scripts/serve-backend-and-frontend
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT, '.serve-backend-frontend.pids.json');
const SHARED_CARGO_TARGET =
  process.env.CARGO_TARGET_DIR || path.resolve(ROOT, '../cdd-gateway/target');
const IS_WIN = process.platform === 'win32';

const SHARED_DATABASE_URL =
  process.env.CDD__DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/cdd';
const SHARED_JWT_SECRET = process.env.CDD__JWT_SECRET || 'super-secret-key';

/** Shared Cargo environment variables to avoid duplicate target directories and debuginfo bloat. */
const SHARED_CARGO_ENV = {
  CARGO_TARGET_DIR: SHARED_CARGO_TARGET,
  CARGO_PROFILE_DEV_DEBUG: '0',
  CARGO_TERM_COLOR: 'always',
  CDD__DATABASE_URL: SHARED_DATABASE_URL,
  CDD__JWT_SECRET: SHARED_JWT_SECRET,
};

/** Ports used by the local CDD backend and frontend stack. */
const STACK_PORTS = [8080, 8081, 8082, 8083, 8085];

/** Process binary/command names associated with the local CDD stack. */
const STACK_PROCESS_NAMES = ['cdd-gateway', 'cdd-control-plane', 'cdd-storage', 'cdd-publisher'];

/** ANSI color codes for distinct service log prefixes. */
const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

/**
 * Service definitions to launch concurrently.
 * Each backend runs `cargo run` from its sibling `../cdd-*` directory in the background,
 * while the frontend runs the `serve_local` make target.
 */
const SERVICES = [
  {
    name: 'cdd-storage',
    color: COLORS.cyan,
    cwd: path.resolve(ROOT, '../cdd-storage'),
    command: 'cargo',
    args: ['run'],
    env: {
      ...SHARED_CARGO_ENV,
      HOST: '127.0.0.1',
      PORT: '8085',
      RUST_LOG: process.env.RUST_LOG || 'info,cdd_storage=debug',
    },
  },
  {
    name: 'cdd-control-plane',
    color: COLORS.magenta,
    cwd: path.resolve(ROOT, '../cdd-control-plane'),
    command: 'cargo',
    args: ['run'],
    env: {
      ...SHARED_CARGO_ENV,
      CDD__SERVER_BIND: '127.0.0.1:8081',
      RUST_LOG: process.env.RUST_LOG || 'info,cdd_control_plane=debug',
    },
  },
  {
    name: 'cdd-publisher',
    color: COLORS.yellow,
    cwd: path.resolve(ROOT, '../cdd-publisher'),
    command: 'cargo',
    args: ['run'],
    env: {
      ...SHARED_CARGO_ENV,
      CONTROL_PLANE_URL: 'http://127.0.0.1:8081',
      RUST_LOG: process.env.RUST_LOG || 'info,cdd_publisher=debug',
    },
  },
  {
    name: 'cdd-gateway',
    color: COLORS.green,
    cwd: path.resolve(ROOT, '../cdd-gateway'),
    command: 'cargo',
    args: ['run'],
    env: {
      ...SHARED_CARGO_ENV,
      CDD__SERVER_BIND: '127.0.0.1:8080',
      CDD__CONTROL_PLANE_URL: 'http://127.0.0.1:8081',
      CDD__DOCS_UI_URL: 'http://127.0.0.1:8082',
      CDD__WEB_UI_URL: 'http://127.0.0.1:8083',
      CDD__OFFLINE_MODE: process.env.CDD__OFFLINE_MODE || 'false',
      RUST_LOG: process.env.RUST_LOG || 'info,cdd_gateway=debug',
    },
  },
  {
    name: 'cdd-web-ui',
    color: COLORS.blue,
    cwd: ROOT,
    command: IS_WIN ? 'cmd.exe' : process.env.MAKE || 'make',
    args: IS_WIN ? ['/d', '/s', '/c', 'make.bat serve_local'] : ['serve_local'],
    env: {
      FORCE_COLOR: '1',
    },
    isPrimary: true,
  },
];

const PAD_WIDTH = Math.max(...SERVICES.map((s) => s.name.length));

/**
 * Formats a padded, colorized log prefix for a service.
 * @param {string} name Service name.
 * @param {string} color ANSI color escape sequence.
 * @param {'stdout' | 'stderr'} streamType Stream identifier.
 * @returns {string} Formatted prefix string.
 */
function formatPrefix(name, color, streamType) {
  const padded = name.padEnd(PAD_WIDTH, ' ');
  const streamTag = streamType === 'stderr' ? `${COLORS.red}!${COLORS.reset}` : ' ';
  return `${color}[${padded}]${COLORS.reset}${streamTag}| `;
}

/**
 * Pipes a readable stream line-by-line to a target writable stream with a service prefix.
 * @param {import('node:stream').Readable} readable Source child stdout/stderr stream.
 * @param {import('node:stream').Writable} writable Target process.stdout or process.stderr.
 * @param {string} prefix Formatted service prefix.
 */
function pipeWithPrefix(readable, writable, prefix) {
  const rl = readline.createInterface({ input: readable, crlfDelay: Infinity });
  rl.on('line', (line) => {
    writable.write(`${prefix}${line}
`);
  });
}

/**
 * Safely kills a single PID (and its process group on Unix or process tree on Windows).
 * @param {number} pid Target process ID.
 */
function killPidTree(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (IS_WIN) {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {
    // Process already terminated
  }
}

/**
 * Kills all dangling backend and frontend processes and frees ports `8080`, `8081`, `8082`, `8083`, and `8085`.
 */
export function stopBackendAndFrontend() {
  // 1. Kill any tracked PIDs from .serve-backend-frontend.pids.json
  if (fs.existsSync(PID_FILE)) {
    try {
      const trackedPids = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
      if (Array.isArray(trackedPids)) {
        for (const pid of trackedPids) {
          killPidTree(Number(pid));
        }
      }
    } catch {
      // Ignore malformed PID file
    }
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      // Ignore unlink error
    }
  }

  // 2. Kill processes bound to stack TCP ports (8080, 8081, 8082, 8083, 8085)
  const nlChar = String.fromCharCode(10);
  for (const port of STACK_PORTS) {
    try {
      if (IS_WIN) {
        const netstatOut = execSync(`netstat -ano | findstr :${port}`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const pids = new Set();
        for (const line of netstatOut.split(nlChar)) {
          const parts = line.trim().split(/ +/);
          const pid = Number(parts[parts.length - 1]);
          if (pid && pid !== process.pid) {
            pids.add(pid);
          }
        }
        for (const pid of pids) {
          killPidTree(pid);
        }
      } else {
        const lsofOut = execSync(`lsof -ti tcp:${port}`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        for (const rawPid of lsofOut.split(nlChar)) {
          const pid = Number(rawPid.trim());
          if (pid && pid !== process.pid) {
            killPidTree(pid);
          }
        }
      }
    } catch {
      // No process listening on this port
    }
  }

  // 3. Kill any dangling cargo/target binaries for cdd-gateway, cdd-control-plane, cdd-storage, cdd-publisher, or ng serve --port 8083
  for (const procName of STACK_PROCESS_NAMES) {
    try {
      if (IS_WIN) {
        execSync(`taskkill /IM ${procName}.exe /F /T`, { stdio: 'ignore' });
      } else {
        execSync(`pkill -9 -f "${procName}"`, { stdio: 'ignore' });
      }
    } catch {
      // No matching process
    }
  }

  try {
    if (!IS_WIN) {
      execSync('pkill -9 -f "ng serve --port 8083"', { stdio: 'ignore' });
    }
  } catch {
    // No matching ng serve process
  }

  console.log(
    `Stopped all dangling backend/frontend processes and freed ports ${STACK_PORTS.join(', ')}.`,
  );
}

/**
 * Starts all backend `cargo run` processes in the background and `serve_local` in the foreground,
 * multiplexing all stdout and stderr logs centrally.
 */
export function startBackendAndFrontend() {
  stopBackendAndFrontend();

  const children = [];
  const spawnedPids = [process.pid];
  let shuttingDown = false;

  /**
   * Terminates all active child processes cleanly.
   * @param {number} exitCode Exit code to terminate with.
   */
  function shutdownAll(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
      if (child.pid) {
        killPidTree(child.pid);
      }
    }
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {
      // Ignore cleanup error
    }

    setTimeout(() => {
      process.exit(exitCode);
    }, 150);
  }

  process.on('SIGINT', () => shutdownAll(0));
  process.on('SIGTERM', () => shutdownAll(0));

  for (const svc of SERVICES) {
    const outPrefix = formatPrefix(svc.name, svc.color, 'stdout');
    const errPrefix = formatPrefix(svc.name, svc.color, 'stderr');

    if (!fs.existsSync(svc.cwd)) {
      process.stderr.write(`${errPrefix}Directory not found: ${svc.cwd} (skipping)
`);
      continue;
    }

    process.stdout.write(
      `${outPrefix}Starting (${svc.command} ${svc.args.join(' ')}) in ${svc.cwd}
`,
    );

    const child = spawn(svc.command, svc.args, {
      cwd: svc.cwd,
      env: { ...process.env, ...svc.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !IS_WIN,
    });

    children.push(child);
    if (child.pid) {
      spawnedPids.push(child.pid);
    }

    if (child.stdout) {
      pipeWithPrefix(child.stdout, process.stdout, outPrefix);
    }
    if (child.stderr) {
      pipeWithPrefix(child.stderr, process.stderr, errPrefix);
    }

    child.on('error', (err) => {
      process.stderr.write(`${errPrefix}Failed to spawn process: ${err.message}
`);
      if (svc.isPrimary) {
        shutdownAll(1);
      }
    });

    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      const status = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      if (code && code !== 0) {
        process.stderr.write(`${errPrefix}Exited with ${status}
`);
      } else {
        process.stdout.write(`${outPrefix}Exited with ${status}
`);
      }
      if (svc.isPrimary) {
        shutdownAll(code ?? 0);
      }
    });
  }

  fs.writeFileSync(PID_FILE, JSON.stringify(spawnedPids, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (process.argv.includes('--unserve') || process.argv.includes('--stop')) {
    stopBackendAndFrontend();
  } else {
    startBackendAndFrontend();
  }
}
