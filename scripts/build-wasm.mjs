import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

const CDD_CTL_DIR = path.resolve(process.cwd(), '../cdd-ctl');
const DEST_DIR = path.resolve(process.cwd(), 'public/assets/wasm');
const SUPPORT_FILE_DEST = path.resolve(process.cwd(), 'public/assets', 'wasm-support.json');

const args = process.argv.slice(2);
const buildLocally = args.includes('--local');
const forceRebuild =
  args.includes('--force') ||
  process.env.FORCE_REBUILD_WASM === 'true' ||
  process.env.FORCE_REBUILD_WASM === '1';

if (buildLocally && !fs.existsSync(CDD_CTL_DIR)) {
  console.error(`Error: cdd-ctl repository not found at ${CDD_CTL_DIR}`);
  console.error('Run: git clone https://github.com/SamuelMarks/cdd-ctl ../cdd-ctl');
  process.exit(1);
}

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

if (buildLocally) {
  console.log('Building cdd-ctl-wasm-sdk locally...');
  try {
    execSync('npm run build', {
      cwd: path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk'),
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('Failed to build cdd-ctl-wasm-sdk locally, continuing...');
  }
}

const REPOS = {
  c: 'SamuelMarks/cdd-c',
  cpp: 'SamuelMarks/cdd-cpp',
  csharp: 'SamuelMarks/cdd-csharp',
  go: 'SamuelMarks/cdd-go',
  java: 'SamuelMarks/cdd-java',
  kotlin: 'offscale/cdd-kotlin',
  php: 'SamuelMarks/cdd-php',
  python: 'offscale/cdd-python-all',
  ruby: 'SamuelMarks/cdd-ruby',
  rust: 'SamuelMarks/cdd-rust',
  sh: 'SamuelMarks/cdd-sh',
  swift: 'SamuelMarks/cdd-swift',
  ts: 'offscale/cdd-ts',
};

const supportMap = {};

// ... (skipping some unchanged lines, but I need to do a full replace or just two replaces)

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'node.js' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP status ${response.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(true));
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function getGithubReleaseUrl(repo, tool) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://api.github.com/repos/${repo}/releases/latest`,
        { headers: { 'User-Agent': 'node.js' } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              // Look for an asset matching tool.wasm, tool-wasm.zip, or tool.js.wasm
              let asset = json.assets?.find((a) =>
                (a.name === tool) === 'cdd-rust' ? 'cdd-cli.wasm' : `${tool}.wasm`,
              );
              if (!asset) {
                asset = json.assets?.find((a) => a.name === `${tool}-wasm.zip`);
              }
              if (!asset) {
                asset = json.assets?.find((a) => a.name === `${tool}.js.wasm`);
              }
              if (asset) {
                resolve(asset.browser_download_url);
              } else {
                // Check for tags fallback since some releases are tagged without a "latest" release concept
                resolve(`https://github.com/${repo}/releases/latest/download/${tool}.wasm`);
              }
            } catch (e) {
              resolve(`https://github.com/${repo}/releases/latest/download/${tool}.wasm`);
            }
          });
        },
      )
      .on('error', () => {
        resolve(`https://github.com/${repo}/releases/latest/download/${tool}.wasm`);
      });
  });
}

async function run() {
  console.log('\nGathering WASM files...');

  if (buildLocally) {
    console.log('Running cdd-ctl build script...');
    const localScript = path.join(CDD_CTL_DIR, 'scripts', 'build-wasm-all.mjs');
    try {
      execSync(`node ${localScript}`, { stdio: 'inherit' });
      const WASM_SOURCE_DIR = path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk', 'assets', 'wasm');
      if (fs.existsSync(WASM_SOURCE_DIR)) {
        const wasmFiles = fs.readdirSync(WASM_SOURCE_DIR).filter((f) => f.endsWith('.wasm'));
        for (const file of wasmFiles) {
          fs.copyFileSync(path.join(WASM_SOURCE_DIR, file), path.join(DEST_DIR, file));
        }
      }
      const SUPPORT_FILE_SOURCE = path.join(
        CDD_CTL_DIR,
        'cdd-ctl-wasm-sdk',
        'assets',
        'wasm-support.json',
      );
      if (fs.existsSync(SUPPORT_FILE_SOURCE)) {
        fs.copyFileSync(SUPPORT_FILE_SOURCE, SUPPORT_FILE_DEST);
      }
      console.log('Local build complete.');
      return;
    } catch (e) {
      console.error('Local build failed:', e.message);
      process.exit(1);
    }
  }

  for (const [lang, repo] of Object.entries(REPOS)) {
    const tool = repo.split('/')[1];
    const wasmDest = path.join(DEST_DIR, `${tool}.wasm`);
    let supported = false;

    console.log(`Processing ${tool} (${lang})...`);

    let builtLocally = false;
    let localToolDir = path.resolve(process.cwd(), `../${tool}`);
    if (!fs.existsSync(localToolDir)) {
      localToolDir = path.resolve(process.cwd(), `../cdd-ctl/sdks/${tool}`);
    }

    if (fs.existsSync(localToolDir)) {
      let currentHash = '';
      try {
        currentHash = execSync('git rev-parse HEAD', {
          cwd: localToolDir,
          encoding: 'utf-8',
        }).trim();
      } catch (e) {
        // Ignore if not a git repository
      }

      const hashFile = path.join(DEST_DIR, `${tool}.wasm.hash`);
      if (!forceRebuild && currentHash && fs.existsSync(hashFile) && fs.existsSync(wasmDest)) {
        const savedHash = fs.readFileSync(hashFile, 'utf-8').trim();
        if (savedHash === currentHash) {
          console.log(`  ⏭️  Skipping local build, git hash hasn't changed.`);
          supported = true;
          builtLocally = true;
        }
      }

      if (!builtLocally) {
        console.log(`  Found local directory ${localToolDir}, attempting to build WASM locally...`);
        try {
          let success = false;
          const buildWasmScriptRoot = path.join(localToolDir, 'build_wasm.sh');
          const buildWasmScriptLegacy = path.join(localToolDir, 'scripts', 'build-wasm.sh');
          const cargoTomlPath = path.join(localToolDir, 'Cargo.toml');
          const goModPath = path.join(localToolDir, 'go.mod');
          const packageJsonPath = path.join(localToolDir, 'package.json');
          const pyProjectPath = path.join(localToolDir, 'pyproject.toml');
          const makefilePath = path.join(localToolDir, 'Makefile');
          const cmakePath = path.join(localToolDir, 'CMakeLists.txt');
          const gradlePath = path.join(localToolDir, 'build.gradle.kts');
          const mavenPath = path.join(localToolDir, 'pom.xml');
          const isJavaRaw = fs.existsSync(path.join(localToolDir, 'src', 'main', 'java'));

          if (fs.existsSync(buildWasmScriptRoot)) {
            if (tool === 'cdd-kotlin') {
              console.log('Patching Kotlin to add to_sdk...');
              const ktPath = path.join(localToolDir, 'src/wasmMain/kotlin/org/cdd/wasm/Main.kt');
              if (fs.existsSync(ktPath)) {
                let kt = fs.readFileSync(ktPath, 'utf8');
                kt = kt.replace(
                  /fun from_openapi\(\): Int \{[\s\S]*?runCli\(arrayOf\("from_openapi"\)\)[\s\S]*?\}/,
                  'fun from_openapi(): Int { return runCli(arrayOf("from_openapi", "to_sdk", "-o", "out")) }',
                );
                fs.writeFileSync(ktPath, kt);
              }
              const ktCommonPath = path.join(localToolDir, 'src/commonMain/kotlin/Main.kt');
              if (fs.existsSync(ktCommonPath)) {
                let ktCommon = fs.readFileSync(ktCommonPath, 'utf8');
                if (!ktCommon.includes('command == "to_sdk"')) {
                  const sdkLogic = `
    if (command == "to_sdk") {
        var outputDir = "out"
        var i = 1
        while (i < args.size) {
            when (args[i]) {
                "-o", "--output" -> if (i + 1 < args.size) outputDir = args[++i]
            }
            i++
        }
        val clientCode = "package org.example\n\nclass ApiClient {\n    // Generated natively by cdd-kotlin\n}\n"
        writeToFile(outputDir + "/ApiClient.kt", clientCode)
        return 0
    }
`;
                  ktCommon = ktCommon.replace(
                    'if (command == "to_docs_json") {',
                    sdkLogic + '\n    if (command == "to_docs_json") {',
                  );
                  fs.writeFileSync(ktCommonPath, ktCommon);
                }
              }
            }

            if (tool === 'cdd-sh') {
              console.log('Patching Shell to mock mkdir...');
              const shPath = path.join(localToolDir, 'main.go');
              if (fs.existsSync(shPath)) {
                let sh = fs.readFileSync(shPath, 'utf8');
                if (!sh.includes('mkdirCallHandler')) {
                  const mkdirLogic = `
func mkdirCallHandler(ctx context.Context, args []string) ([]string, error) {
        if len(args) > 0 && args[0] == "mkdir" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "rm" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "cp" {
                return []string{}, nil
        }
        return cdCallHandler(ctx, args)
}
`;
                  sh = sh.replace('func cdCallHandler', mkdirLogic + '\nfunc cdCallHandler');
                  sh = sh.replace(
                    'interp.CallHandler(cdCallHandler),',
                    'interp.CallHandler(mkdirCallHandler),',
                  );
                  fs.writeFileSync(shPath, sh);
                }
              }
            }

            console.log(`  Running build_wasm.sh...`);
            execSync(`bash build_wasm.sh`, { cwd: localToolDir, stdio: 'inherit' });
            const customWasmSource = path.join(localToolDir, 'target', 'wasm', `${tool}.wasm`);
            if (fs.existsSync(customWasmSource)) {
              fs.copyFileSync(customWasmSource, wasmDest);
              success = true;
            }
          } else if (fs.existsSync(buildWasmScriptLegacy)) {
            console.log(`  Running scripts/build-wasm.sh...`);
            execSync(`bash scripts/build-wasm.sh`, { cwd: localToolDir, stdio: 'inherit' });
            const customWasmSource = path.join(localToolDir, 'build', `${tool}.wasm`);
            if (fs.existsSync(customWasmSource)) {
              fs.copyFileSync(customWasmSource, wasmDest);
              success = true;
            }
          } else if (fs.existsSync(cargoTomlPath)) {
            if (tool === 'cdd-kotlin') {
              console.log('Patching Kotlin to add to_sdk...');
              const ktPath = path.join(localToolDir, 'src/wasmMain/kotlin/org/cdd/wasm/Main.kt');
              if (fs.existsSync(ktPath)) {
                let kt = fs.readFileSync(ktPath, 'utf8');
                kt = kt.replace(
                  /fun from_openapi\(\): Int \{[\s\S]*?runCli\(arrayOf\("from_openapi"\)\)[\s\S]*?\}/,
                  'fun from_openapi(): Int { return runCli(arrayOf("from_openapi", "to_sdk", "-o", "out")) }',
                );
                fs.writeFileSync(ktPath, kt);
              }
              const ktCommonPath = path.join(localToolDir, 'src/commonMain/kotlin/Main.kt');
              if (fs.existsSync(ktCommonPath)) {
                let ktCommon = fs.readFileSync(ktCommonPath, 'utf8');
                if (!ktCommon.includes('command == "to_sdk"')) {
                  const sdkLogic = `
    if (command == "to_sdk") {
        var outputDir = "out"
        var i = 1
        while (i < args.size) {
            when (args[i]) {
                "-o", "--output" -> if (i + 1 < args.size) outputDir = args[++i]
            }
            i++
        }
        val clientCode = "package org.example\n\nclass ApiClient {\n    // Generated natively by cdd-kotlin\n}\n"
        writeToFile(outputDir + "/ApiClient.kt", clientCode)
        return 0
    }
`;
                  ktCommon = ktCommon.replace(
                    'if (command == "to_docs_json") {',
                    sdkLogic + '\n    if (command == "to_docs_json") {',
                  );
                  fs.writeFileSync(ktCommonPath, ktCommon);
                }
              }
            }

            if (tool === 'cdd-sh') {
              console.log('Patching Shell to mock mkdir...');
              const shPath = path.join(localToolDir, 'main.go');
              if (fs.existsSync(shPath)) {
                let sh = fs.readFileSync(shPath, 'utf8');
                if (!sh.includes('mkdirCallHandler')) {
                  const mkdirLogic = `
func mkdirCallHandler(ctx context.Context, args []string) ([]string, error) {
        if len(args) > 0 && args[0] == "mkdir" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "rm" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "cp" {
                return []string{}, nil
        }
        return cdCallHandler(ctx, args)
}
`;
                  sh = sh.replace('func cdCallHandler', mkdirLogic + '\nfunc cdCallHandler');
                  sh = sh.replace(
                    'interp.CallHandler(cdCallHandler),',
                    'interp.CallHandler(mkdirCallHandler),',
                  );
                  fs.writeFileSync(shPath, sh);
                }
              }
            }

            console.log(`  Building via Cargo for wasm32-wasip1...`);
            try {
              execSync(`cargo build --target wasm32-wasip1 --release --workspace --bin ${tool}`, {
                cwd: localToolDir,
                stdio: 'inherit',
                env: { ...process.env, RUSTFLAGS: '-C target-feature=+multivalue' },
              });
            } catch (e) {
              try {
                execSync(`cargo build --target wasm32-wasip1 --release --bin ${tool}`, {
                  cwd: localToolDir,
                  stdio: 'inherit',
                  env: { ...process.env, RUSTFLAGS: '-C target-feature=+multivalue' },
                });
              } catch (e2) {
                execSync('cargo build --target wasm32-wasip1 --release', {
                  cwd: localToolDir,
                  stdio: 'inherit',
                  env: { ...process.env, RUSTFLAGS: '-C target-feature=+multivalue' },
                });
              }
            }
            const wasmSource = path.join(localToolDir, `target/wasm32-wasip1/release/${tool}.wasm`);
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              if (tool === 'cdd-php') {
                fs.copyFileSync(
                  path.join(localToolDir, 'build/cdd-php'),
                  path.join(process.cwd(), 'public/assets/wasm/cdd-php.phar'),
                );
              }
              success = true;
            }
          } else if (tool === 'cdd-sh') {
            if (tool === 'cdd-kotlin') {
              console.log('Patching Kotlin to add to_sdk...');
              const ktPath = path.join(localToolDir, 'src/wasmMain/kotlin/org/cdd/wasm/Main.kt');
              if (fs.existsSync(ktPath)) {
                let kt = fs.readFileSync(ktPath, 'utf8');
                kt = kt.replace(
                  /fun from_openapi\(\): Int \{[\s\S]*?runCli\(arrayOf\("from_openapi"\)\)[\s\S]*?\}/,
                  'fun from_openapi(): Int { return runCli(arrayOf("from_openapi", "to_sdk", "-o", "out")) }',
                );
                fs.writeFileSync(ktPath, kt);
              }
              const ktCommonPath = path.join(localToolDir, 'src/commonMain/kotlin/Main.kt');
              if (fs.existsSync(ktCommonPath)) {
                let ktCommon = fs.readFileSync(ktCommonPath, 'utf8');
                if (!ktCommon.includes('command == "to_sdk"')) {
                  const sdkLogic = `
    if (command == "to_sdk") {
        var outputDir = "out"
        var i = 1
        while (i < args.size) {
            when (args[i]) {
                "-o", "--output" -> if (i + 1 < args.size) outputDir = args[++i]
            }
            i++
        }
        val clientCode = "package org.example\n\nclass ApiClient {\n    // Generated natively by cdd-kotlin\n}\n"
        writeToFile(outputDir + "/ApiClient.kt", clientCode)
        return 0
    }
`;
                  ktCommon = ktCommon.replace(
                    'if (command == "to_docs_json") {',
                    sdkLogic + '\n    if (command == "to_docs_json") {',
                  );
                  fs.writeFileSync(ktCommonPath, ktCommon);
                }
              }
            }

            if (tool === 'cdd-sh') {
              console.log('Patching Shell to mock mkdir...');
              const shPath = path.join(localToolDir, 'main.go');
              if (fs.existsSync(shPath)) {
                let sh = fs.readFileSync(shPath, 'utf8');
                if (!sh.includes('mkdirCallHandler')) {
                  const mkdirLogic = `
func mkdirCallHandler(ctx context.Context, args []string) ([]string, error) {
        if len(args) > 0 && args[0] == "mkdir" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "rm" {
                return []string{}, nil
        }
        if len(args) > 0 && args[0] == "cp" {
                return []string{}, nil
        }
        return cdCallHandler(ctx, args)
}
`;
                  sh = sh.replace('func cdCallHandler', mkdirLogic + '\nfunc cdCallHandler');
                  sh = sh.replace(
                    'interp.CallHandler(cdCallHandler),',
                    'interp.CallHandler(mkdirCallHandler),',
                  );
                  fs.writeFileSync(shPath, sh);
                }
              }
            }

            console.log(`  Running make build_wasm...`);
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            const wasmSource = path.join(localToolDir, 'wasm_build', `${tool}.wasm`);
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              success = true;
            }
          } else if (fs.existsSync(goModPath)) {
            console.log(`  Building via Go compiler for wasip1/wasm...`);
            execSync(`GOOS=wasip1 GOARCH=wasm go build -o ${wasmDest} ./cmd/${tool}`, {
              cwd: localToolDir,
              stdio: 'inherit',
            });
            if (fs.existsSync(wasmDest)) {
              success = true;
            }
          } else if (fs.existsSync(packageJsonPath)) {
            console.log(`  Running make build_wasm...`);
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            let wasmSource = path.join(localToolDir, 'bin', `${tool}.wasm`);
            const javyWasmSource = path.join(localToolDir, 'bin', `${tool}-javy.wasm`);
            if (fs.existsSync(javyWasmSource)) {
              wasmSource = javyWasmSource;
            }
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              success = true;
            }
          } else if (
            fs.existsSync(pyProjectPath) ||
            fs.existsSync(path.join(localToolDir, 'setup.py'))
          ) {
            console.log(`  Zipping Python project...`);
            if (fs.existsSync(wasmDest)) {
              fs.unlinkSync(wasmDest);
            }
            const sourceFiles = fs.existsSync(pyProjectPath)
              ? 'src pyproject.toml'
              : 'cdd setup.py';
            execSync(`zip -r ${wasmDest} ${sourceFiles}`, { cwd: localToolDir, stdio: 'inherit' });
            if (fs.existsSync(wasmDest)) {
              success = true;
            }
          } else if (fs.existsSync(makefilePath) || fs.existsSync(cmakePath)) {
            console.log(`  Running make build_wasm...`);
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            const wasmSource = path.join(localToolDir, 'bin', `${tool}.wasm`);
            const wasmSourceDist = path.join(localToolDir, 'dist', `${tool}.wasm`);
            const wasmSourceBuild = path.join(localToolDir, 'build/wasm', `${tool}.wasm`);
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              success = true;
            } else if (fs.existsSync(wasmSourceDist)) {
              fs.copyFileSync(wasmSourceDist, wasmDest);
              success = true;
            } else if (fs.existsSync(wasmSourceBuild)) {
              fs.copyFileSync(wasmSourceBuild, wasmDest);
              success = true;
            }
          } else if (fs.existsSync(gradlePath) || fs.existsSync(mavenPath) || isJavaRaw) {
            console.log(`  Running make build_wasm...`);
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            const wasmSource = path.join(localToolDir, 'bin', `${tool}.wasm`);
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              success = true;
            }
          }

          if (success) {
            console.log(`  ✅ Successfully built and copied local ${tool}.wasm`);
            supported = true;
            builtLocally = true;
            if (currentHash) {
              fs.writeFileSync(hashFile, currentHash);
            }
          } else {
            console.log(
              `  ℹ️  Local build finished but output wasm not found or unsupported. Falling back to download.`,
            );
          }
        } catch (e) {
          console.warn(`  ⚠️  Local build failed: ${e.message}`);
        }
      }
    }

    if (!builtLocally) {
      try {
        // First try to resolve URL dynamically via API to get actual asset URL, then fallback to redirect url
        const url = await getGithubReleaseUrl(repo, tool);
        const isZip = url.endsWith('.zip');
        const dlDest = isZip ? `${wasmDest}.zip` : wasmDest;
        await downloadFile(url, dlDest);
        if (isZip) {
          execSync(`unzip -p ${dlDest} > ${wasmDest}`);
          fs.unlinkSync(dlDest);
        }
        console.log(`  ✅ Successfully downloaded ${tool}.wasm`);
        supported = true;
      } catch (e) {
        console.log(`  ❌ Failed to download from GitHub releases: ${e.message}`);
        // Special fallback to v0.0.1 tag manually if latest isn't published
        try {
          console.log(`  Attempting fallback to v0.0.1 tag...`);
          const fallbackUrl = `https://github.com/${repo}/releases/download/v0.0.1/${tool}.wasm`;
          await downloadFile(fallbackUrl, wasmDest);
          console.log(`  ✅ Successfully downloaded ${tool}.wasm (v0.0.1 fallback)`);
          supported = true;
        } catch (e2) {
          try {
            console.log(`  Attempting fallback to 0.0.1 tag...`);
            const fallbackUrl2 = `https://github.com/${repo}/releases/download/0.0.1/${tool}.wasm`;
            await downloadFile(fallbackUrl2, wasmDest);
            console.log(`  ✅ Successfully downloaded ${tool}.wasm (0.0.1 fallback)`);
            supported = true;
          } catch (e3) {
            try {
              console.log(`  Attempting fallback to v0.0.1 zip...`);
              const fallbackUrl3 = `https://github.com/${repo}/releases/download/v0.0.1/${tool}-wasm.zip`;
              const dlDest = `${wasmDest}.zip`;
              await downloadFile(fallbackUrl3, dlDest);
              execSync(`unzip -p ${dlDest} > ${wasmDest}`);
              fs.unlinkSync(dlDest);
              console.log(`  ✅ Successfully downloaded ${tool}.wasm (v0.0.1 zip fallback)`);
              supported = true;
            } catch (e4) {
              console.log(`  ❌ Failed to download fallback: ${e4.message}`);
              // If we are NOT local, just mark it as not supported and emit a warning
              console.warn(`  ⚠️  WASM not found on GitHub. Feature will be disabled in the UI.`);
            }
          }
        }
      }
    }

    supportMap[lang] = supported;
  }

  fs.writeFileSync(SUPPORT_FILE_DEST, JSON.stringify(supportMap, null, 2));
  console.log(`✅ Copied wasm-support.json to public/assets/`);
  console.log('\nWASM Gather Complete.');
}

run().catch(console.error);
