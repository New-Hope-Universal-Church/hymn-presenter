/**
 * api.js
 * Reads the hymn dataset from the NHUC lyrics API. Read-only.
 *
 * The API URL and read key come from LYRICS_API_URL and LYRICS_API_KEY, or from
 * data/api-config.json, which is not committed. See api-config.example.json.
 * A key shipped inside an app can be extracted, so this one can only read, and
 * it can be cut off from the server side without touching anyone's installed app.
 */

const fs   = require('fs');
const path = require('path');

const TIMEOUT_MS = 30000;

function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(path.join(__dirname, 'api-config.json'), 'utf8'));
  } catch { /* no file, environment variables may still be set */ }
  return {
    url: process.env.LYRICS_API_URL || file.url,
    key: process.env.LYRICS_API_KEY || file.key,
  };
}

// Fetch the whole dataset, unless the API says our version is still current.
// Resolves to { unchanged: true, version } or { unchanged: false, version, books, hymns, blocks }.
async function fetchSnapshot(knownVersion = null) {
  const { url, key } = loadConfig();
  if (!url || !key) throw new Error('Lyrics API is not configured (api-config.json).');

  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
  if (knownVersion !== null) headers['If-None-Match'] = `"${knownVersion}"`;

  const res = await fetch(`${url.replace(/\/+$/, '')}/v1/snapshot`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 304) return { unchanged: true, version: knownVersion };
  if (!res.ok) throw new Error(`Lyrics API answered ${res.status}.`);

  const data = await res.json();
  return { unchanged: false, ...data };
}

// Address of the API's import page, where hymns are corrected. Null if the API is not configured.
function importPageUrl() {
  const { url } = loadConfig();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin + '/';
  } catch { return null; }
}

module.exports = { fetchSnapshot, importPageUrl };
