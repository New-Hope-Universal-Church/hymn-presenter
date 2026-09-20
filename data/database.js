const path      = require('path');
const fs        = require('fs');
const initSqlJs = require('sql.js');
const { fetchSnapshot } = require('./api');

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
// Local SQLite cache (for offline use)
// ─────────────────────────────────────────────
class LocalCache {
  constructor() { this.db = null; }

  async open() {
    const SQL    = await initSqlJs();
    const dbPath = getCachedDbPath();
    if (fs.existsSync(dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(dbPath));
      this._migrate();
    } else {
      this.db = new SQL.Database();
      this._createTables();
      this._save();
    }
  }

  _createTables() {
    this.db.run(`CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, alias TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS hymns (id TEXT PRIMARY KEY, number INTEGER, title TEXT, author TEXT, book_id TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS hymn_blocks (id TEXT PRIMARY KEY, hymn_id TEXT, position INTEGER, type TEXT, label TEXT, text TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  }

  // Migrate an existing cache to the current schema. Safe to re-run —
  // each step is idempotent and failures (e.g. column already exists)
  // are swallowed.
  _migrate() {
    const cols = this.db.exec(`PRAGMA table_info(books)`);
    const names = cols.length ? cols[0].values.map(r => r[1]) : [];
    if (!names.includes('alias')) {
      this.db.run(`ALTER TABLE books ADD COLUMN alias TEXT`);
      this._save();
    }
    // Caches from before versioned sync have no meta table, so they download once.
    this.db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
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

  // The dataset version this cache was last synced to, or null if never.
  getVersion() {
    const row = this.query(`SELECT value FROM meta WHERE key = 'dataset_version'`)[0];
    return row ? Number(row.value) : null;
  }

  // Replace the whole cache with a snapshot from the lyrics API. The snapshot
  // is the full dataset, so rows deleted on the server disappear here too.
  // The version is saved in the same file, so data and version never disagree.
  async rebuildFull(books, hymns, blocks, version) {
    const SQL      = await initSqlJs();
    const previous = this.db;
    this.db        = new SQL.Database();
    this._createTables();

    try {
      this.db.run('BEGIN');
      for (const b of books) {
        this.db.run(`INSERT OR REPLACE INTO books (id, name, alias) VALUES (?, ?, ?)`, [b.id, b.name, b.alias || null]);
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
      this.db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('dataset_version', ?)`, [String(version)]);
      this.db.run('COMMIT');
      this._save();
    } catch (err) {
      this.db = previous; // a bad snapshot must not replace a working cache
      throw err;
    }
    console.log(`Cache rebuilt at version ${version}: ${books.length} books, ${hymns.length} hymns, ${blocks.length} blocks`);
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

    // Ask the lyrics API for updates in the background
    this._syncFromCloud().catch(err => {
      console.log('Cloud sync skipped (offline):', err.message);
    });
  }

  // Ask the lyrics API for the dataset. If our saved version is still current
  // the API answers with an empty 304 and nothing is downloaded, so this is
  // cheap enough to run on every start and from Help, Check for Database Updates.
  // Resolves to { changed, version }. Rejects when the API cannot be reached.
  async _syncFromCloud() {
    const known    = this.cache.getVersion();
    const snapshot = await fetchSnapshot(known);
    this.online    = true;
    if (snapshot.unchanged) {
      console.log(`Already at version ${known}.`);
      return { changed: false, version: known };
    }
    await this.cache.rebuildFull(snapshot.books, snapshot.hymns, snapshot.blocks, snapshot.version);
    return { changed: true, version: snapshot.version };
  }

  // ── Books ──────────────────────────────────────────────
  getAllBooks() {
    return this.cache.query(`SELECT id, name, alias FROM books ORDER BY name ASC`);
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

  query(sql, params = []) {
    return this.cache.query(sql, params);
  }
}

module.exports = Database;