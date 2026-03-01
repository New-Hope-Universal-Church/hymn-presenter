const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { app } = require('electron');

const GITHUB_USER = 'Adehwam21';
const GITHUB_REPO = 'hymn-presenter';
const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/db-version.json`;
const DB_URL      = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/latest/download/mhb_clean.db`;

function getCacheDir() {
  const dir = path.join(app.getPath('userData'), 'nhuc-db');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCachedDbPath()      { return path.join(getCacheDir(), 'mhb_clean.db'); }
function getCachedVersionPath() { return path.join(getCacheDir(), 'db-version.json'); }

function getLocalVersion() {
  try {
    const raw = fs.readFileSync(getCachedVersionPath(), 'utf8');
    return JSON.parse(raw).version || '0.0.0';
  } catch { return '0.0.0'; }
}

function saveLocalVersion(version) {
  fs.writeFileSync(getCachedVersionPath(), JSON.stringify({ version }), 'utf8');
}

function isNewer(remote, local) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [lMaj, lMin, lPat] = parse(local);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const attempt = (u) => {
      https.get(u, { headers: { 'User-Agent': 'hymn-presenter' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return attempt(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
      }).on('error', reject);
    };
    attempt(url);
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const attempt = (u) => {
      https.get(u, { headers: { 'User-Agent': 'nhuc-hymn-projector' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return attempt(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const total    = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const tmpPath  = destPath + '.tmp';
        const file     = fs.createWriteStream(tmpPath);
        res.on('data', chunk => {
          downloaded += chunk.length;
          if (total && onProgress) onProgress(Math.round((downloaded / total) * 100));
        });
        res.pipe(file);
        file.on('finish', () => { file.close(() => { fs.renameSync(tmpPath, destPath); resolve(); }); });
        file.on('error', err => { fs.unlink(tmpPath, () => {}); reject(err); });
        res.on('error',  err => { fs.unlink(tmpPath, () => {}); reject(err); });
      }).on('error', reject);
    };
    attempt(url);
  });
}

async function syncDatabase(onProgress) {
  try {
    const remote        = await fetchJson(VERSION_URL);
    const remoteVersion = remote.version;
    const localVersion  = getLocalVersion();
    console.log(`DB sync: local=${localVersion} remote=${remoteVersion}`);
    if (!isNewer(remoteVersion, localVersion)) {
      return { status: 'up-to-date', version: localVersion };
    }
    await downloadFile(DB_URL, getCachedDbPath(), onProgress);
    saveLocalVersion(remoteVersion);
    return { status: 'updated', version: remoteVersion };
  } catch (err) {
    console.log('DB sync failed:', err.message);
    return { status: 'offline', version: getLocalVersion() };
  }
}

function getDbPath() {
  const cached = getCachedDbPath();
  if (fs.existsSync(cached)) { console.log('Using cached db:', cached); return cached; }
  const bundled = [
    path.join(process.resourcesPath || '', 'mhb_clean.db'),
    path.join(__dirname, 'mhb_clean.db'),
    path.join(__dirname, '..', 'data', 'mhb_clean.db'),
  ].find(p => fs.existsSync(p));
  if (bundled) { console.log('Using bundled db:', bundled); return bundled; }
  throw new Error('No database found. Connect to the internet to download it.');
}

module.exports = { syncDatabase, getDbPath, getLocalVersion };
