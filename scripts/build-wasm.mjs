import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

const DEST_DIR = path.resolve(process.cwd(), 'public/assets/wasm');
const SUPPORT_FILE_DEST = path.resolve(process.cwd(), 'public/assets', 'wasm-support.json');

const args = process.argv.slice(2);
const buildLocally = args.includes('--local');

function isEnvEnabled(val) {
  if (val === undefined || val === null) return false;
  const normalized = String(val).trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no';
}

const forceRebuild =
  args.includes('--force') ||
  isEnvEnabled(process.env.FORCE_REBUILD_WASM) ||
  isEnvEnabled(process.env.REBUILD_ALL);

function shouldForceRebuildTool(tool, lang) {
  if (forceRebuild) return true;
  const toolEnvKey = `REBUILD_${tool.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const langEnvKey = lang ? `REBUILD_CDD_${lang.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : '';
  return (
    isEnvEnabled(process.env[toolEnvKey]) ||
    (langEnvKey ? isEnvEnabled(process.env[langEnvKey]) : false)
  );
}

function hasNonMarkdownEdits(porcelainOutput) {
  const entries = porcelainOutput.split('\0');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const filePath = entry.slice(3);
    if (!filePath.toLowerCase().endsWith('.md')) {
      return true;
    }
    if (status[0] === 'R' || status[0] === 'C') {
      const origPath = entries[++i] || '';
      if (origPath && !origPath.toLowerCase().endsWith('.md')) {
        return true;
      }
    }
  }
  return false;
}

function getRepoGitState(repoDir) {
  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const statusOutput = execSync('git status --porcelain -z --untracked-files=all', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const dirtyNonMarkdown = hasNonMarkdownEdits(statusOutput);
    return { hash, canReuseCache: Boolean(hash) && !dirtyNonMarkdown, dirtyNonMarkdown };
  } catch (e) {
    return { hash: '', canReuseCache: false, dirtyNonMarkdown: true };
  }
}

function isValidWasmOrZipBinary(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size < 1024) return false;
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  const magic = buf.readUInt32BE(0);
  return magic === 0x0061736d || magic === 0x504b0304;
}

function isValidJsWrapper(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return stat.size >= 1024;
}

function hasValidLocalArtifact(tool, wasmDest) {
  if (tool === 'cdd-csharp') {
    const appBundleDest = path.join(DEST_DIR, 'cdd-csharp');
    return fs.existsSync(appBundleDest) && fs.readdirSync(appBundleDest).length > 0;
  }
  if (tool === 'cdd-java') {
    return (
      isValidWasmOrZipBinary(wasmDest) &&
      isValidWasmOrZipBinary(path.join(DEST_DIR, 'cdd-java.js.wasm')) &&
      isValidJsWrapper(path.join(DEST_DIR, 'cdd-java.js'))
    );
  }
  return isValidWasmOrZipBinary(wasmDest);
}

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function buildLocalSiblingPackage(pkgName, clearAngularCacheOnBuild = false) {
  const pkgDir = path.resolve(process.cwd(), `../${pkgName}`);
  if (!fs.existsSync(pkgDir)) {
    throw new Error(
      `Local directory not found for ${pkgName} at ${pkgDir}. --local requires all sibling packages to be built locally.`,
    );
  }
  const pkgHashFile = path.join(DEST_DIR, `${pkgName}.hash`);
  const pkgDistDir = path.join(pkgDir, 'dist');
  const pkgGitState = getRepoGitState(pkgDir);
  const hasPkgDist = fs.existsSync(pkgDistDir) && fs.readdirSync(pkgDistDir).length > 0;
  const savedPkgHash = fs.existsSync(pkgHashFile)
    ? fs.readFileSync(pkgHashFile, 'utf-8').trim()
    : '';
  const forceRebuildPkg = shouldForceRebuildTool(pkgName);

  if (
    !forceRebuildPkg &&
    pkgGitState.canReuseCache &&
    hasPkgDist &&
    savedPkgHash === pkgGitState.hash
  ) {
    console.log(
      `⏭️  Skipping ${pkgName} local build (git hash unchanged and no non-markdown edits).`,
    );
    return;
  }

  console.log(`Building ${pkgName} locally...`);
  try {
    execSync('npm run build', {
      cwd: pkgDir,
      stdio: 'inherit',
    });
    const postBuildGitState = getRepoGitState(pkgDir);
    if (postBuildGitState.canReuseCache) {
      fs.writeFileSync(pkgHashFile, postBuildGitState.hash);
    } else if (fs.existsSync(pkgHashFile)) {
      fs.unlinkSync(pkgHashFile);
    }
    if (clearAngularCacheOnBuild) {
      const angularCacheDir = path.resolve(process.cwd(), '.angular/cache');
      if (fs.existsSync(angularCacheDir)) {
        fs.rmSync(angularCacheDir, { recursive: true, force: true });
      }
    }
  } catch (e) {
    throw new Error(`Failed to build ${pkgName} locally: ${e.message}`);
  }
}

if (buildLocally) {
  buildLocalSiblingPackage('cdd-docs-ui', true);
  buildLocalSiblingPackage('cdd-browser-sdk', true);
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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'node.js',
            ...(process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {}),
          },
        },
        (response) => {
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
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
        },
      )
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function getReleaseFileName(tool) {
  if (tool === 'cdd-csharp') return 'cdd-csharp-wasm.zip';
  if (tool === 'cdd-ts') return 'cdd-ts-javy.wasm';
  return `${tool}.wasm`;
}

function getGithubLatestRelease(repo, tool) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          headers: {
            'User-Agent': 'node.js',
            ...(process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 404) {
              return reject(new Error(`No tagged latest release found for ${repo} (HTTP 404)`));
            }
            if (res.statusCode === 403 || res.statusCode === 429) {
              return resolve({
                tagName: 'latest',
                url: `https://github.com/${repo}/releases/latest/download/${getReleaseFileName(tool)}`,
              });
            }
            if (res.statusCode !== 200) {
              return reject(
                new Error(
                  `GitHub API /releases/latest failed for ${repo} with HTTP ${res.statusCode}`,
                ),
              );
            }
            try {
              const json = JSON.parse(data);
              if (!json || !json.tag_name || json.draft || json.prerelease) {
                return reject(new Error(`No valid tagged latest release found for ${repo}`));
              }
              let asset;
              if (tool === 'cdd-csharp') {
                asset = json.assets?.find((a) => a.name === `${tool}-wasm.zip`);
                if (!asset) {
                  asset = json.assets?.find((a) => a.name === `${tool}.wasm`);
                }
              } else {
                asset = json.assets?.find((a) =>
                  tool === 'cdd-ts' ? a.name === 'cdd-ts-javy.wasm' : a.name === `${tool}.wasm`,
                );
                if (!asset) {
                  asset = json.assets?.find((a) => a.name === `${tool}-wasm.zip`);
                }
              }
              if (!asset) {
                asset = json.assets?.find((a) => a.name === `${tool}.js.wasm`);
              }
              if (asset && asset.browser_download_url) {
                const jsAsset =
                  tool === 'cdd-java' ? json.assets?.find((a) => a.name === 'cdd-java.js') : null;
                const jsWasmAsset =
                  tool === 'cdd-java'
                    ? json.assets?.find((a) => a.name === 'cdd-java.js.wasm')
                    : null;
                return resolve({
                  tagName: json.tag_name,
                  url: asset.browser_download_url,
                  jsUrl: jsAsset?.browser_download_url || null,
                  jsWasmUrl: jsWasmAsset?.browser_download_url || null,
                });
              }
              return reject(
                new Error(
                  `Tagged latest release ${json.tag_name} for ${repo} does not contain a WASM asset for ${tool}`,
                ),
              );
            } catch (e) {
              return reject(
                new Error(`Failed to parse /releases/latest response for ${repo}: ${e.message}`),
              );
            }
          });
        },
      )
      .on('error', () => {
        resolve({
          tagName: 'latest',
          url: `https://github.com/${repo}/releases/latest/download/${getReleaseFileName(tool)}`,
        });
      });
  });
}

function removeToolArtifacts(tool, wasmDest) {
  if (fs.existsSync(wasmDest)) {
    fs.unlinkSync(wasmDest);
  }
  if (tool === 'cdd-csharp') {
    const appBundleDest = path.join(DEST_DIR, 'cdd-csharp');
    if (fs.existsSync(appBundleDest)) {
      fs.rmSync(appBundleDest, { recursive: true, force: true });
    }
  }
  if (tool === 'cdd-java') {
    const jsWasm = path.join(DEST_DIR, 'cdd-java.js.wasm');
    const jsWrapper = path.join(DEST_DIR, 'cdd-java.js');
    if (fs.existsSync(jsWasm)) fs.unlinkSync(jsWasm);
    if (fs.existsSync(jsWrapper)) fs.unlinkSync(jsWrapper);
  }
}

async function run() {
  console.log(
    buildLocally
      ? '\nGathering WASM files from local builds ONLY (--local)...'
      : '\nGathering WASM files from tagged latest GitHub releases ONLY...',
  );

  for (const [lang, repo] of Object.entries(REPOS)) {
    const tool = repo.split('/')[1];
    let wasmDest = path.join(DEST_DIR, `${tool}.wasm`);
    if (tool === 'cdd-ts') wasmDest = path.join(DEST_DIR, 'cdd-ts-javy.wasm');
    let supported = false;

    console.log(`Processing ${tool} (${lang})...`);

    const hashFile = path.join(DEST_DIR, `${tool}.wasm.hash`);
    const releaseFile = path.join(DEST_DIR, `${tool}.wasm.release`);
    const forceRebuildTool = shouldForceRebuildTool(tool, lang);

    if (buildLocally) {
      const localToolDir = path.resolve(process.cwd(), `../${tool}`);
      if (!fs.existsSync(localToolDir)) {
        throw new Error(
          `Local repository directory not found for ${tool} at ${localToolDir}. --local requires all WASM targets to be built locally and never from GitHub releases.`,
        );
      }

      if (fs.existsSync(releaseFile)) {
        fs.unlinkSync(releaseFile);
        if (fs.existsSync(hashFile)) fs.unlinkSync(hashFile);
        removeToolArtifacts(tool, wasmDest);
      }

      const gitState = getRepoGitState(localToolDir);
      const currentHash = gitState.hash;
      let builtLocally = false;

      if (
        !forceRebuildTool &&
        gitState.canReuseCache &&
        fs.existsSync(hashFile) &&
        !fs.existsSync(releaseFile) &&
        hasValidLocalArtifact(tool, wasmDest)
      ) {
        const savedHash = fs.readFileSync(hashFile, 'utf-8').trim();
        if (savedHash === currentHash) {
          console.log(
            `  ⏭️  Skipping local build, git hash hasn't changed and no non-markdown edits exist.`,
          );
          supported = true;
          builtLocally = true;
        }
      }

      if (!builtLocally) {
        console.log(`  Found local directory ${localToolDir}, building WASM locally...`);
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

          if (tool === 'cdd-csharp') {
            console.log('  Running make build_wasm...');
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            const appBundleSrc = path.join(localToolDir, 'bin/cdd-csharp');
            const appBundleDest = path.join(DEST_DIR, 'cdd-csharp');
            if (fs.existsSync(appBundleSrc)) {
              execSync(
                'rm -rf ' + appBundleDest + ' && cp -r ' + appBundleSrc + ' ' + appBundleDest,
              );
              console.log('  Copied AppBundle for cdd-csharp to ' + appBundleDest);
              success = true;
            }
          } else if (fs.existsSync(buildWasmScriptRoot)) {
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
            console.log(`  Building via Cargo for wasm32-wasip1...`);
            const cargoRustFlags = '--cfg no_salsa_async_drops -C target-feature=+multivalue';
            try {
              execSync(`cargo build --target wasm32-wasip1 --release --workspace --bin ${tool}`, {
                cwd: localToolDir,
                stdio: 'inherit',
                env: { ...process.env, RUSTFLAGS: cargoRustFlags },
              });
            } catch (e) {
              try {
                execSync(`cargo build --target wasm32-wasip1 --release --bin ${tool}`, {
                  cwd: localToolDir,
                  stdio: 'inherit',
                  env: { ...process.env, RUSTFLAGS: cargoRustFlags },
                });
              } catch (e2) {
                execSync('cargo build --target wasm32-wasip1 --release', {
                  cwd: localToolDir,
                  stdio: 'inherit',
                  env: { ...process.env, RUSTFLAGS: cargoRustFlags },
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
            if (fs.existsSync(wasmDest) && fs.statSync(wasmDest).size > 0) {
              success = true;
            }
          } else if (fs.existsSync(gradlePath) || fs.existsSync(mavenPath) || isJavaRaw) {
            console.log(`  Running make build_wasm...`);
            execSync('make build_wasm', { cwd: localToolDir, stdio: 'inherit' });
            const wasmSource = path.join(localToolDir, 'bin', `${tool}.wasm`);
            const jsWasmSource = path.join(localToolDir, 'bin', `${tool}.js.wasm`);
            const jsSource = path.join(localToolDir, 'bin', `${tool}.js`);
            if (fs.existsSync(wasmSource)) {
              fs.copyFileSync(wasmSource, wasmDest);
              if (fs.existsSync(jsWasmSource)) {
                fs.copyFileSync(jsWasmSource, path.join(DEST_DIR, `${tool}.js.wasm`));
              } else {
                fs.copyFileSync(wasmSource, path.join(DEST_DIR, `${tool}.js.wasm`));
              }
              if (fs.existsSync(jsSource)) {
                fs.copyFileSync(jsSource, path.join(DEST_DIR, `${tool}.js`));
              }
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
            if (fs.existsSync(wasmDest) && fs.statSync(wasmDest).size > 0) {
              fs.unlinkSync(wasmDest);
            }
            const sourceFiles = fs.existsSync(pyProjectPath)
              ? 'src pyproject.toml'
              : 'cdd setup.py';
            execSync(`zip -r ${wasmDest} ${sourceFiles} -x "*/__pycache__/*" "*.pyc"`, {
              cwd: localToolDir,
              stdio: 'inherit',
            });
            if (fs.existsSync(wasmDest) && fs.statSync(wasmDest).size > 0) {
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
          }

          if (success && !hasValidLocalArtifact(tool, wasmDest)) {
            throw new Error(
              `Invalid or dummy WASM artifact produced for ${tool} at ${wasmDest} (missing WASM/ZIP magic header or required JS wrapper).`,
            );
          }

          if (!success) {
            throw new Error(`Local build for ${tool} did not produce a valid WASM artifact.`);
          }

          console.log(`  ✅ Successfully built and copied local ${tool}.wasm`);
          supported = true;
          builtLocally = true;
          const postBuildGitState = getRepoGitState(localToolDir);
          if (postBuildGitState.canReuseCache) {
            fs.writeFileSync(hashFile, postBuildGitState.hash);
          } else if (fs.existsSync(hashFile)) {
            fs.unlinkSync(hashFile);
          }
        } catch (e) {
          throw new Error(`Local WASM build failed for ${tool}: ${e.message}`);
        }
      }
    } else {
      // Production / Release mode: ONLY use tagged latest GitHub releases.
      // Never build from local ../cdd-* directories and never reuse locally built artifacts.
      if (fs.existsSync(hashFile) || !fs.existsSync(releaseFile)) {
        if (fs.existsSync(hashFile)) fs.unlinkSync(hashFile);
        removeToolArtifacts(tool, wasmDest);
      }

      try {
        const releaseInfo = await getGithubLatestRelease(repo, tool);
        const releaseId = `${releaseInfo.tagName}@${releaseInfo.url}`;

        if (
          !forceRebuildTool &&
          !fs.existsSync(hashFile) &&
          fs.existsSync(releaseFile) &&
          hasValidLocalArtifact(tool, wasmDest) &&
          fs.readFileSync(releaseFile, 'utf-8').trim() === releaseId
        ) {
          console.log(
            `  ⏭️  Skipping download, ${path.basename(wasmDest)} already matches tagged latest release (${releaseInfo.tagName}).`,
          );
          supportMap[lang] = true;
          continue;
        }

        const url = releaseInfo.url;
        const isZip = url.endsWith('.zip');
        const dlDest = isZip ? `${wasmDest}.zip` : wasmDest;
        await downloadFile(url, dlDest);
        if (isZip) {
          if (tool === 'cdd-csharp') {
            execSync(
              'rm -rf ' +
                DEST_DIR +
                '/cdd-csharp && unzip -q ' +
                dlDest +
                ' -d ' +
                DEST_DIR +
                ' && rm ' +
                dlDest,
            );
          } else {
            try {
              execSync('unzip -p ' + dlDest + ' > ' + wasmDest);
            } catch (e) {
              if (fs.existsSync(wasmDest)) fs.unlinkSync(wasmDest);
              throw e;
            }
            fs.unlinkSync(dlDest);
          }
        }
        if (tool === 'cdd-java') {
          if (releaseInfo.jsWasmUrl && releaseInfo.jsWasmUrl !== url) {
            await downloadFile(releaseInfo.jsWasmUrl, path.join(DEST_DIR, 'cdd-java.js.wasm'));
          } else {
            fs.copyFileSync(wasmDest, path.join(DEST_DIR, 'cdd-java.js.wasm'));
          }
          const jsUrl = releaseInfo.jsUrl || url.replace(/cdd-java(\.js)?\.wasm$/, 'cdd-java.js');
          await downloadFile(jsUrl, path.join(DEST_DIR, 'cdd-java.js'));
        }
        if (!hasValidLocalArtifact(tool, wasmDest)) {
          removeToolArtifacts(tool, wasmDest);
          throw new Error(`Downloaded artifact for ${tool} is a dummy or invalid WASM binary.`);
        }
        fs.writeFileSync(releaseFile, releaseId);
        console.log(
          `  ✅ Successfully downloaded ${path.basename(wasmDest)} from tagged latest release (${releaseInfo.tagName})`,
        );
        supported = true;
      } catch (e) {
        if (fs.existsSync(releaseFile)) fs.unlinkSync(releaseFile);
        removeToolArtifacts(tool, wasmDest);
        console.log(`  ❌ Failed to download tagged latest release from GitHub: ${e.message}`);
        console.warn(
          `  ⚠️  Tagged latest release WASM not found on GitHub for ${tool}. Feature will be disabled in the UI.`,
        );
      }
    }

    supportMap[lang] = supported;
  }

  fs.writeFileSync(SUPPORT_FILE_DEST, JSON.stringify(supportMap, null, 2) + '\n');
  console.log(`✅ Copied wasm-support.json to public/assets/`);
  console.log('\nWASM Gather Complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
