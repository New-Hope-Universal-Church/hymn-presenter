const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

class Database {
  constructor() {
    this.db = null;
  }

  // sql.js is async — call this before using the database
  async connect() {
    try {
      const possiblePaths = [
        path.join(process.resourcesPath || '', 'mhb_clean.db'),
        path.join(__dirname, 'mhb_clean.db'),
        path.join(__dirname, '..', 'data', 'mhb_clean.db'),
      ];

      let dbPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          dbPath = p;
          break;
        }
      }

      if (!dbPath) {
        throw new Error('mhb_clean.db not found. Please place it in the data/ folder.');
      }

      // sql.js loads the entire DB as a binary buffer into memory
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(fileBuffer);

      console.log('Connected to database:', dbPath);
    } catch (err) {
      console.error('Database connection failed:', err.message);
      throw err;
    }
  }

  // ─── Helper: run a SELECT and return all rows as objects ──
  query(sql, params = []) {
    const results = this.db.exec(sql, params);
    if (!results || results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  // ─── Helper: run a SELECT and return a single row ─────────
  queryOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // ─── Get all hymns (for initial list) ─────────────────────
  getAllHymns() {
    return this.query(`
      SELECT id, number, title, author
      FROM hymns
      ORDER BY number ASC
      LIMIT 100
    `);
  }

  // ─── Search by hymn number ────────────────────────────────
  searchByNumber(number) {
    const result = this.queryOne(`
      SELECT id, number, title, author
      FROM hymns
      WHERE number = ?
    `, [number]);
    return result ? [result] : [];
  }

  // ─── Search by title ──────────────────────────────────────
  searchByTitle(query) {
    return this.query(`
      SELECT id, number, title, author
      FROM hymns
      WHERE LOWER(title) LIKE LOWER(?)
      ORDER BY number ASC
      LIMIT 50
    `, [`%${query}%`]);
  }

  // ─── Get hymn blocks (verses/refrains) ────────────────────
  getHymnBlocks(hymnId) {
    return this.query(`
      SELECT id, hymn_id, position, type, label, text
      FROM hymn_blocks
      WHERE hymn_id = ?
      ORDER BY position ASC
    `, [hymnId]);
  }

  // ─── Get a single hymn by ID ──────────────────────────────
  getHymnById(id) {
    return this.queryOne(`
      SELECT id, number, title, author
      FROM hymns
      WHERE id = ?
    `, [id]);
  }
}

module.exports = Database;
