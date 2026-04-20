const path      = require('path');
const fs        = require('fs');
const https     = require('https');
const initSqlJs = require('sql.js');

// ─────────────────────────────────────────────
// Supabase config
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://vhjpxdkisexajxiorktv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoanB4ZGtpc2V4YWp4aW9ya3R2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMzMDM1MSwiZXhwIjoyMDg3OTA2MzUxfQ.xhIHgXKKGW3kbdixL_uPvSZ985KF6BRKrjct4XSR5Ns';

// ─────────────────────────────────────────────
// Local cache path
// ─────────────────────────────────────────────
const { app } = require('electron');

function getCacheDir() {
  const dir = path.join(app.getPath('userData'), 'nhuc-db');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCachedDbPath() { return path.join(getCacheDir(), 'cache.db'); }

// ─────────────────────────────────────────────
// Supabase REST helpers
// ─────────────────────────────────────────────
function sbFetch(method, path_, body = null) {
  return new Promise((resolve, reject) => {
    const url     = new URL(`${SUPABASE_URL}/rest/v1/${path_}`);
    const options = {
      method,
      hostname: url.hostname,
      path:     url.pathname + url.search,
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Supabase ${method} ${path_} [${res.statusCode}]: ${data}`));
          return;
        }
        try { resolve(data ? JSON.parse(data) : null); }
        catch { resolve(null); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const sb = {
  get:    (table, query = '')  => sbFetch('GET',    `${table}${query}`),
  post:   (table, body)        => sbFetch('POST',   table, body),
  patch:  (table, query, body) => sbFetch('PATCH',  `${table}${query}`, body),
  delete: (table, query)       => sbFetch('DELETE', `${table}${query}`),
};

// ─────────────────────────────────────────────
// Local SQLite cache (for offline use)
// ─────────────────────────────────────────────
class LocalCache {
  constructor() { this.db = null; }

  async open() {
    const SQL    = await initSqlJs();
    const dbPath = getCachedDbPath();
    if (fs.existsSync(dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      this.db = new SQL.Database();
      this._createTables();
      this._save();
    }
  }

  _createTables() {
    this.db.run(`CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS hymns (id INTEGER PRIMARY KEY, number INTEGER, title TEXT, author TEXT, book_id INTEGER)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS hymn_blocks (id INTEGER PRIMARY KEY, hymn_id INTEGER, position INTEGER, type TEXT, label TEXT, text TEXT)`);
  }

  _save() {
    fs.writeFileSync(getCachedDbPath(), Buffer.from(this.db.export()));
  }

  query(sql, params = []) {
    const results = this.db.exec(sql, params);
    if (!results || !results.length) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  // Merge Supabase data into the local cache (upsert).
  //
  // Previously this function dropped and recreated the SQL.js DB from
  // scratch. That created a race: if the user created a book or hymn
  // while the background sync was in flight, the snapshot fetched from
  // Supabase was already stale, and rebuilding from it wiped the new
  // row from the local cache. The user would then see their freshly
  // created book with no way to add hymns to it (dropdown had the book,
  // but queries against book_id returned nothing because the cache no
  // longer contained it).
  //
  // Instead we INSERT OR REPLACE each fetched row. Rows that the user
  // created locally during sync stay intact. Deletions from other
  // clients won't be mirrored here automatically — run a manual
  // "Check for Database Updates" (which calls rebuildFull) to force
  // a full refresh.
  async rebuild(books, hymns, blocks) {
    if (!this.db) {
      const SQL = await initSqlJs();
      this.db   = new SQL.Database();
    }
    this._createTables(); // CREATE TABLE IF NOT EXISTS — safe to re-run

    for (const b of books) {
      this.db.run(`INSERT OR REPLACE INTO books (id, name) VALUES (?, ?)`, [b.id, b.name]);
    }
    for (const h of hymns) {
      this.db.run(
        `INSERT OR REPLACE INTO hymns (id, number, title, author, book_id) VALUES (?,?,?,?,?)`,
        [h.id, h.number, h.title, h.author || null, h.book_id]
      );
    }
    for (const bl of blocks) {
      this.db.run(
        `INSERT OR REPLACE INTO hymn_blocks (id, hymn_id, position, type, label, text) VALUES (?,?,?,?,?,?)`,
        [bl.id, bl.hymn_id, bl.position, bl.type, bl.label, bl.text]
      );
    }

    this._save();
    console.log(`Cache merged: ${books.length} books, ${hymns.length} hymns, ${blocks.length} blocks`);
  }

  // Full rebuild — drops the DB and repopulates from the snapshot.
  // Only call this from a manual sync, when the user has explicitly
  // asked for a refresh and concurrent writes are not a concern.
  async rebuildFull(books, hymns, blocks) {
    const SQL = await initSqlJs();
    this.db   = new SQL.Database();
    this._createTables();

    for (const b of books) {
      this.db.run(`INSERT OR REPLACE INTO books (id, name) VALUES (?, ?)`, [b.id, b.name]);
    }
    for (const h of hymns) {
      this.db.run(
        `INSERT OR REPLACE INTO hymns (id, number, title, author, book_id) VALUES (?,?,?,?,?)`,
        [h.id, h.number, h.title, h.author || null, h.book_id]
      );
    }
    for (const bl of blocks) {
      this.db.run(
        `INSERT OR REPLACE INTO hymn_blocks (id, hymn_id, position, type, label, text) VALUES (?,?,?,?,?,?)`,
        [bl.id, bl.hymn_id, bl.position, bl.type, bl.label, bl.text]
      );
    }

    this._save();
    console.log(`Cache rebuilt: ${books.length} books, ${hymns.length} hymns, ${blocks.length} blocks`);
  }

  updateBook(id, name) {
    this.db.run(`INSERT OR REPLACE INTO books (id, name) VALUES (?, ?)`, [id, name]);
    this._save();
  }

  deleteBook(id) {
    this.db.run(`UPDATE hymns SET book_id = NULL WHERE book_id = ?`, [id]);
    this.db.run(`DELETE FROM books WHERE id = ?`, [id]);
    this._save();
  }

  updateHymn(h) {
    this.db.run(
      `INSERT OR REPLACE INTO hymns (id, number, title, author, book_id) VALUES (?,?,?,?,?)`,
      [h.id, h.number, h.title, h.author || null, h.book_id]
    );
    this._save();
  }

  deleteHymn(id) {
    this.db.run(`DELETE FROM hymn_blocks WHERE hymn_id = ?`, [id]);
    this.db.run(`DELETE FROM hymns WHERE id = ?`, [id]);
    this._save();
  }

  updateBlock(bl) {
    this.db.run(
      `INSERT OR REPLACE INTO hymn_blocks (id, hymn_id, position, type, label, text) VALUES (?,?,?,?,?,?)`,
      [bl.id, bl.hymn_id, bl.position, bl.type, bl.label, bl.text]
    );
    this._save();
  }

  deleteBlock(id) {
    this.db.run(`DELETE FROM hymn_blocks WHERE id = ?`, [id]);
    this._save();
  }
}

// ─────────────────────────────────────────────
// Main Database class
// ─────────────────────────────────────────────
class Database {
  constructor() {
    this.cache   = new LocalCache();
    this.online  = false;
  }

  async connect() {
    // Always open local cache first — app is usable immediately
    await this.cache.open();
    console.log('Local cache loaded.');

    // Try to sync from Supabase in background
    this._syncFromCloud().catch(err => {
      console.log('Cloud sync skipped (offline):', err.message);
    });
  }

  // Fetch all rows from a table, paginating past Supabase's 1000-row limit
  async _fetchAll(table, query = '') {
    const PAGE = 1000;
    let rows = [];
    let from = 0;
    while (true) {
      const sep   = query.includes('?') ? '&' : '?';
      const batch = await sb.get(table, `${query}${sep}order=id&limit=${PAGE}&offset=${from}`);
      if (!batch || !batch.length) break;
      rows = rows.concat(batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
    return rows;
  }

  // Background sync — merges Supabase into local cache without dropping it.
  // Safe to run concurrently with user writes (they will be preserved).
  async _syncFromCloud() {
    console.log('Syncing from Supabase...');
    const [books, hymns, blocks] = await Promise.all([
      this._fetchAll('books'),
      this._fetchAll('hymns', '?select=id,number,title,author,book_id'),
      this._fetchAll('hymn_blocks'),
    ]);
    await this.cache.rebuild(books, hymns, blocks);
    this.online = true;
    console.log(`Synced from Supabase: ${books.length} books, ${hymns.length} hymns, ${blocks.length} blocks`);
  }

  // Manual sync — full rebuild of the local cache. Drops and repopulates
  // from the Supabase snapshot. Triggered from Help → Check for Database
  // Updates. Use this when the user wants an authoritative refresh.
  async _syncFromCloudFull() {
    console.log('Full sync from Supabase...');
    const [books, hymns, blocks] = await Promise.all([
      this._fetchAll('books'),
      this._fetchAll('hymns', '?select=id,number,title,author,book_id'),
      this._fetchAll('hymn_blocks'),
    ]);
    await this.cache.rebuildFull(books, hymns, blocks);
    this.online = true;
    console.log(`Full sync done: ${books.length} books, ${hymns.length} hymns, ${blocks.length} blocks`);
  }

  // ── ID allocation ──────────────────────────────────────
  //
  // The Supabase schema uses `bigint primary key` without an identity
  // or default sequence, so the server cannot assign a fresh id on
  // INSERT. Even when a sequence is present it can drift out of sync
  // after a bulk CSV import (sequence stays at 1 while rows occupy
  // 1..N), causing 23505 duplicate-key errors on the next insert.
  //
  // To sidestep this we allocate the id on the client from MAX(id)+1
  // of the local cache. The cache mirrors Supabase (modulo in-flight
  // edits from other clients), so this is safe for a single-operator
  // setup. If two operators insert at the same instant they'd collide;
  // acceptable for this app.
  _nextId(table) {
    const row = this.cache.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${table}`)[0];
    return (row ? row.m : 0) + 1;
  }

  // ── Books ──────────────────────────────────────────────
  getAllBooks() {
    return this.cache.query(`SELECT id, name FROM books ORDER BY name ASC`);
  }

  async addBook(name) {
    const id   = this._nextId('books');
    const rows = await sb.post('books', { id, name });
    const book = Array.isArray(rows) ? rows[0] : rows;
    if (!book || !book.id) throw new Error('Supabase did not return the inserted book.');
    this.cache.updateBook(book.id, book.name);
    return book;
  }

  async deleteBook(id) {
    await sb.patch('hymns', `?book_id=eq.${id}`, { book_id: null });
    await sb.delete('books', `?id=eq.${id}`);
    this.cache.deleteBook(id);
  }

  // ── Hymns ──────────────────────────────────────────────
  getAllHymns(bookId = null) {
    if (bookId) {
      return this.cache.query(
        `SELECT id, number, title, author, book_id FROM hymns WHERE book_id = ? ORDER BY number ASC`,
        [bookId]
      );
    }
    return this.cache.query(
      `SELECT id, number, title, author, book_id FROM hymns ORDER BY number ASC`
    );
  }

  searchByNumber(number, bookId = null) {
    const rows = bookId
      ? this.cache.query(`SELECT id, number, title, author, book_id FROM hymns WHERE number = ? AND book_id = ?`, [number, bookId])
      : this.cache.query(`SELECT id, number, title, author, book_id FROM hymns WHERE number = ?`, [number]);
    return rows;
  }

  searchByTitle(query, bookId = null) {
    const rows = bookId
      ? this.cache.query(
          `SELECT id, number, title, author, book_id FROM hymns WHERE LOWER(title) LIKE LOWER(?) AND book_id = ? ORDER BY number ASC`,
          [`%${query}%`, bookId]
        )
      : this.cache.query(
          `SELECT id, number, title, author, book_id FROM hymns WHERE LOWER(title) LIKE LOWER(?) ORDER BY number ASC`,
          [`%${query}%`]
        );
    return rows;
  }

  async addHymn({ number, title, author, bookId }) {
    const id   = this._nextId('hymns');
    const rows = await sb.post('hymns', { id, number, title, author: author || null, book_id: bookId });
    const hymn = Array.isArray(rows) ? rows[0] : rows;
    if (!hymn || !hymn.id) throw new Error('Supabase did not return the inserted hymn.');
    this.cache.updateHymn(hymn);
    return hymn;
  }

  async updateHymn({ id, number, title, author, bookId }) {
    await sb.patch('hymns', `?id=eq.${id}`, { number, title, author: author || null, book_id: bookId });
    this.cache.updateHymn({ id, number, title, author, book_id: bookId });
  }

  async deleteHymn(id) {
    await sb.delete('hymn_blocks', `?hymn_id=eq.${id}`);
    await sb.delete('hymns', `?id=eq.${id}`);
    this.cache.deleteHymn(id);
  }

  getHymnById(id) {
    return this.cache.query(`SELECT id, number, title, author, book_id FROM hymns WHERE id = ?`, [id])[0] || null;
  }

  // ── Blocks ─────────────────────────────────────────────
  getHymnBlocks(hymnId) {
    return this.cache.query(
      `SELECT id, hymn_id, position, type, label, text FROM hymn_blocks WHERE hymn_id = ? ORDER BY position ASC`,
      [hymnId]
    );
  }

  async addBlock({ hymnId, type, label, text, position }) {
    const id    = this._nextId('hymn_blocks');
    const rows  = await sb.post('hymn_blocks', { id, hymn_id: hymnId, type, label, text, position });
    const block = Array.isArray(rows) ? rows[0] : rows;
    if (!block || !block.id) throw new Error('Supabase did not return the inserted block.');
    this.cache.updateBlock(block);
    return block;
  }

  async updateBlock({ id, label, text, type }) {
    // Get current block for hymn_id
    const current = this.cache.query(`SELECT hymn_id, position FROM hymn_blocks WHERE id = ?`, [id])[0];
    await sb.patch('hymn_blocks', `?id=eq.${id}`, { label, text, type });
    if (current) this.cache.updateBlock({ id, hymn_id: current.hymn_id, position: current.position, type, label, text });
  }

  async deleteBlock(id) {
    await sb.delete('hymn_blocks', `?id=eq.${id}`);
    this.cache.deleteBlock(id);
  }

  async reorderBlocks(blocks) {
    // Update each block's position in Supabase
    await Promise.all(blocks.map(({ id, position }) =>
      sb.patch('hymn_blocks', `?id=eq.${id}`, { position })
    ));
    // Update cache
    blocks.forEach(({ id, position }) => {
      const current = this.cache.query(`SELECT * FROM hymn_blocks WHERE id = ?`, [id])[0];
      if (current) this.cache.updateBlock({ ...current, position });
    });
  }

  // ── Legacy run() for any direct SQL still called from main.js ──
  run(sql, params = []) {
    this.cache.db.run(sql, params);
    this.cache._save();
  }

  query(sql, params = []) {
    return this.cache.query(sql, params);
  }
}

module.exports = Database;