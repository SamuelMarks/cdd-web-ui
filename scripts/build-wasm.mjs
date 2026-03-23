import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CDD_CTL_DIR = path.resolve(process.cwd(), '../cdd-ctl');
const BUILD_SCRIPT = path.join(CDD_CTL_DIR, 'scripts', 'build-wasm-all.mjs');
const WASM_SOURCE_DIR = path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk', 'assets', 'wasm');
const DEST_DIR = path.resolve(process.cwd(), 'public/assets/wasm');
const SUPPORT_FILE_SOURCE = path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk', 'assets', 'wasm-support.json');
const SUPPORT_FILE_DEST = path.resolve(process.cwd(), 'public/assets', 'wasm-support.json');

if (!fs.existsSync(CDD_CTL_DIR)) {
  console.error(`Error: cdd-ctl repository not found at ${CDD_CTL_DIR}`);
  console.error('Run: git clone https://github.com/SamuelMarks/cdd-ctl ../cdd-ctl');
  process.exit(1);
}

// 1. Run the build logic housed in ../cdd-ctl
console.log('Running WASM build logic from cdd-ctl...');
if (!fs.existsSync(BUILD_SCRIPT)) {
  console.error(`Error: Expected build script not found at ${BUILD_SCRIPT}`);
  process.exit(1);
}

try {
  execSync(`node ${BUILD_SCRIPT}`, { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to run cdd-ctl build script:', e.message);
  process.exit(1);
}

// 2. Gather all the resulting files into the web UI's public directory
console.log('\nGathering WASM files...');
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

if (fs.existsSync(WASM_SOURCE_DIR)) {
  const wasmFiles = fs.readdirSync(WASM_SOURCE_DIR).filter(f => f.endsWith('.wasm'));
  wasmFiles.forEach(file => {
    fs.copyFileSync(
      path.join(WASM_SOURCE_DIR, file),
      path.join(DEST_DIR, file)
    );
    console.log(`✅ Copied ${file} to public/assets/wasm/`);
  });
} else {
  console.warn(`⚠️  Warning: No WASM source directory found at ${WASM_SOURCE_DIR}`);
}

// Copy the support map
if (fs.existsSync(SUPPORT_FILE_SOURCE)) {
  fs.copyFileSync(SUPPORT_FILE_SOURCE, SUPPORT_FILE_DEST);
  console.log(`✅ Copied wasm-support.json to public/assets/`);
}

console.log('\nWASM Gather Complete.');
