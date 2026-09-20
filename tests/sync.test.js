// Run with: npm test
// Uses a fake lyrics API on localhost, so no network or Electron is needed.

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const http   = require('http');
const Module = require('module');

// database.js asks Electron for the user data folder. Point it at a temp folder.
let userData;
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return { app: { getPath: () => userData } };
  return load.call(this, request, ...rest);
};
const Database = require('../data/database');
const { syncDatabase } = require('../data/db-sync');
const initSqlJs = require('sql.js');

const KEY = 'test-key';

// Ids are UUIDs, so databases created separately never clash.
const BOOK = 'b0000000-0000-4000-8000-000000000001';
const H1   = 'a0000000-0000-4000-8000-000000000001';
const H2   = 'a0000000-0000-4000-8000-000000000002';
const B1   = 'c0000000-0000-4000-8000-000000000001';
const B2   = 'c0000000-0000-4000-8000-000000000002';
const B3   = 'c0000000-0000-4000-8000-000000000003';

function dataset(version, overrides = {}) {
  return {
    version,
    books: [{ id: BOOK, name: 'Methodist Hymn Book', alias: 'MHB' }],
    hymns: [
      { id: H1, number: 1, title: 'O For A Thousand Tongues To Sing', author: 'Charles Wesley', book_id: BOOK },
      { id: H2, number: 2, title: 'Trust And Obey', author: 'John Sammis', book_id: BOOK },
    ],
    blocks: [
      { id: B1, hymn_id: H1, position: 1, type: 'verse', label: 'Verse 1', text: 'O for a thousand tongues to sing\nMy great Redeemer’s praise,' },
      { id: B2, hymn_id: H2, position: 1, type: 'verse', label: 'Verse 1', text: 'When we walk with the Lord' },
      { id: B3, hymn_id: H2, position: 2, type: 'refrain', label: 'Refrain', text: 'Trust and obey' },
    ],
    ...overrides,
  };
}

// A stand-in for the API. `state.data` is what it serves, `state.seen` records each request.
async function fakeApi(state) {
  const server = http.createServer((req, res) => {
    state.seen.push({ url: req.url, auth: req.headers.authorization, etag: req.headers['if-none-match'] });
    if (req.headers.authorization !== `Bearer ${KEY}`) { res.writeHead(401); return res.end('{}'); }
    const etag = `"${state.data.version}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json', ETag: etag });
    res.end(JSON.stringify(state.data));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function setup(t, data = dataset(1)) {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'nhuc-sync-'));
  const state = { data, seen: [] };
  const { server, url } = await fakeApi(state);
  process.env.LYRICS_API_URL = url;
  process.env.LYRICS_API_KEY = KEY;
  t.after(() => { server.close(); fs.rmSync(userData, { recursive: true, force: true }); });
  const db = new Database();
  await db.cache.open();
  return { db, state, url };
}

test('first sync downloads everything and remembers the version', async (t) => {
  const { db, state } = await setup(t);
  assert.equal(db.cache.getVersion(), null);

  const result = await db._syncFromCloud();

  assert.deepEqual(result, { changed: true, version: 1 });
  assert.equal(state.seen.length, 1);
  assert.equal(state.seen[0].etag, undefined);
  assert.deepEqual(db.getAllBooks(), [{ id: BOOK, name: 'Methodist Hymn Book', alias: 'MHB' }]);
  assert.equal(db.getAllHymns(BOOK).length, 2);
  assert.deepEqual(db.getHymnBlocks(H2).map((b) => b.label), ['Verse 1', 'Refrain']);
  assert.match(db.getHymnBlocks(H1)[0].text, /Redeemer’s praise/);
  assert.equal(db.cache.getVersion(), 1);
  assert.equal(db.online, true);
});

test('a second sync sends the version and downloads nothing when it is current', async (t) => {
  const { db, state } = await setup(t);
  await db._syncFromCloud();

  const result = await db._syncFromCloud();

  assert.deepEqual(result, { changed: false, version: 1 });
  assert.equal(state.seen.length, 2);
  assert.equal(state.seen[1].etag, '"1"');
  assert.equal(db.getAllHymns(BOOK).length, 2);
});

test('a newer version replaces the cache, including deletions', async (t) => {
  const { db, state } = await setup(t);
  await db._syncFromCloud();

  state.data = dataset(2, {
    hymns: [state.data.hymns[0]],
    blocks: [{ id: B1, hymn_id: H1, position: 1, type: 'verse', label: 'Verse 1', text: 'corrected text' }],
  });
  const result = await db._syncFromCloud();

  assert.deepEqual(result, { changed: true, version: 2 });
  assert.equal(db.getAllHymns(BOOK).length, 1);
  assert.equal(db.getHymnBlocks(H1)[0].text, 'corrected text');
  assert.deepEqual(db.getHymnBlocks(H2), []);
  assert.equal(db.cache.getVersion(), 2);
});

test('the version survives closing and reopening the app', async (t) => {
  const { db } = await setup(t);
  await db._syncFromCloud();

  const reopened = new Database();
  await reopened.cache.open();

  assert.equal(reopened.cache.getVersion(), 1);
  assert.equal(reopened.getAllHymns(BOOK).length, 2);
});

test('an unreachable server or a wrong key leaves the cache usable', async (t) => {
  const { db, state } = await setup(t);
  await db._syncFromCloud();

  process.env.LYRICS_API_KEY = 'wrong';
  await assert.rejects(db._syncFromCloud(), /401/);
  process.env.LYRICS_API_KEY = KEY;

  process.env.LYRICS_API_URL = 'http://127.0.0.1:1';
  await assert.rejects(db._syncFromCloud());

  assert.equal(db.getAllHymns(BOOK).length, 2);
  assert.equal(db.cache.getVersion(), 1);
  assert.equal(state.seen.length, 2);
});

test('a snapshot that fails halfway does not replace the working cache', async (t) => {
  const { db, state } = await setup(t);
  await db._syncFromCloud();

  state.data = dataset(2, { books: [{ id: BOOK, name: null, alias: null }] });
  await assert.rejects(db._syncFromCloud(), /NOT NULL/);

  assert.equal(db.getAllHymns(BOOK).length, 2);
  assert.equal(db.cache.getVersion(), 1);
  const reopened = new Database();
  await reopened.cache.open();
  assert.equal(reopened.cache.getVersion(), 1);
});

test('an app with no API settings fails clearly', async (t) => {
  const { db } = await setup(t);
  delete process.env.LYRICS_API_URL;
  delete process.env.LYRICS_API_KEY;
  await assert.rejects(db._syncFromCloud(), /not configured/);
});

test('a cache from before versioned sync is upgraded and downloads once', async (t) => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'nhuc-old-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const SQL = await initSqlJs();
  const old = new SQL.Database();
  old.run('CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, alias TEXT)');
  old.run('CREATE TABLE hymns (id INTEGER PRIMARY KEY, number INTEGER, title TEXT, author TEXT, book_id INTEGER)');
  old.run('CREATE TABLE hymn_blocks (id INTEGER PRIMARY KEY, hymn_id INTEGER, position INTEGER, type TEXT, label TEXT, text TEXT)');
  old.run("INSERT INTO hymns VALUES (9, 9, 'Old cached hymn', NULL, 1)");
  fs.mkdirSync(path.join(userData, 'nhuc-db'), { recursive: true });
  fs.writeFileSync(path.join(userData, 'nhuc-db', 'cache.db'), Buffer.from(old.export()));

  const state = { data: dataset(5), seen: [] };
  const { server, url } = await fakeApi(state);
  t.after(() => server.close());
  process.env.LYRICS_API_URL = url;
  process.env.LYRICS_API_KEY = KEY;

  const db = new Database();
  await db.cache.open();
  assert.equal(db.cache.getVersion(), null);
  assert.equal(db.getHymnById(9).title, 'Old cached hymn');

  await db._syncFromCloud();
  assert.equal(db.cache.getVersion(), 5);
  assert.equal(db.getHymnById(9), null);
  assert.equal(db.getHymnById(H1).title, 'O For A Thousand Tongues To Sing');
  assert.equal(typeof db.getAllBooks()[0].id, 'string');
  const idType = db.cache.query(`SELECT type FROM pragma_table_info('hymns') WHERE name = 'id'`)[0].type;
  assert.equal(idType, 'TEXT');
});

test('the Help menu sync reports updated, up to date and offline', async (t) => {
  const { db, state } = await setup(t);

  assert.deepEqual(await syncDatabase(db), { status: 'updated', version: 1, message: 'Database synced successfully.' });
  assert.equal((await syncDatabase(db)).status, 'up-to-date');

  state.data = dataset(2);
  const updated = await syncDatabase(db);
  assert.equal(updated.status, 'updated');
  assert.equal(updated.version, 2);

  process.env.LYRICS_API_URL = 'http://127.0.0.1:1';
  assert.equal((await syncDatabase(db)).status, 'offline');
});
