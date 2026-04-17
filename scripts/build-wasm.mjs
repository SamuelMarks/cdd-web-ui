import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

const CDD_CTL_DIR = path.resolve(process.cwd(), '../cdd-ctl');
const DEST_DIR = path.resolve(process.cwd(), 'public/assets/wasm');
const SUPPORT_FILE_DEST = path.resolve(process.cwd(), 'public/assets', 'wasm-support.json');

const args = process.argv.slice(2);
const buildLocally = args.includes('--local');

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
    execSync('npm run build', { cwd: path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk'), stdio: 'inherit' });
  } catch (e) {
    console.warn('Failed to build cdd-ctl-wasm-sdk locally, continuing...');
  }
}

const REPOS = {
  'c': 'SamuelMarks/cdd-c',
  'cpp': 'SamuelMarks/cdd-cpp',
  'csharp': 'SamuelMarks/cdd-csharp',
  'go': 'SamuelMarks/cdd-go',
  'java': 'SamuelMarks/cdd-java',
  'kotlin': 'offscale/cdd-kotlin',
  'php': 'SamuelMarks/cdd-php',
  'python': 'offscale/cdd-python',
  'ruby': 'SamuelMarks/cdd-ruby',
  'rust': 'SamuelMarks/cdd-rust',
  'sh': 'SamuelMarks/cdd-sh',
  'swift': 'SamuelMarks/cdd-swift',
  'ts': 'offscale/cdd-ts'
};

const supportMap = {};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, (response) => {
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
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function getGithubReleaseUrl(repo, tool) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'node.js' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Look for an asset matching tool.wasm, tool-wasm.zip, or tool.js.wasm
          let asset = json.assets?.find(a => a.name === `${tool}.wasm`);
          if (!asset) {
             asset = json.assets?.find(a => a.name === `${tool}-wasm.zip`);
          }
          if (!asset) {
             asset = json.assets?.find(a => a.name === `${tool}.js.wasm`);
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
    }).on('error', () => {
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
      const SUPPORT_FILE_SOURCE = path.join(CDD_CTL_DIR, 'cdd-ctl-wasm-sdk', 'assets', 'wasm-support.json');
      if (fs.existsSync(SUPPORT_FILE_SOURCE)) {
         fs.copyFileSync(SUPPORT_FILE_SOURCE, SUPPORT_FILE_DEST);
      }
      console.log('Local build complete.');
      return;
    } catch(e) {
      console.error('Local build failed:', e.message);
      process.exit(1);
    }
  }

  for (const [lang, repo] of Object.entries(REPOS)) {
    const tool = `cdd-${lang}`;
    const wasmDest = path.join(DEST_DIR, `${tool}.wasm`);
    let supported = false;

    console.log(`Processing ${tool} (${lang})...`);
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
      } catch(e2) {
         try {
           console.log(`  Attempting fallback to 0.0.1 tag...`);
           const fallbackUrl2 = `https://github.com/${repo}/releases/download/0.0.1/${tool}.wasm`;
           await downloadFile(fallbackUrl2, wasmDest);
           console.log(`  ✅ Successfully downloaded ${tool}.wasm (0.0.1 fallback)`);
           supported = true;
         } catch(e3) {
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
    
    supportMap[lang] = supported;
  }

  fs.writeFileSync(SUPPORT_FILE_DEST, JSON.stringify(supportMap, null, 2));
  console.log(`✅ Copied wasm-support.json to public/assets/`);
  console.log('\nWASM Gather Complete.');
}

run().catch(console.error);
