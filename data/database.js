const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    try {
      const possiblePaths = [
        path.join(process.resourcesPath || '', 'mhb_clean.db'),
        path.join(__dirname, 'mhb_clean.db'),
        path.join(__dirname, '..', 'data', 'mhb_clean.db'),
      ];

      let dbPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { dbPath = p; break; }
      }

      if (!dbPath) throw new Error('mhb_clean.db not found. Please place it in the data/ folder.');

      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(fileBuffer);

      // ── Create books table if it doesn't exist ──
      this.db.run(`
        CREATE TABLE IF NOT EXISTS books (
          id   INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        )
      `);

      // ── Add book_id column to hymns if it doesn't exist ──
      const cols = this.query(`PRAGMA table_info(hymns)`);
      const hasBookId = cols.some(c => c.name === 'book_id');
      if (!hasBookId) {
        this.db.run(`ALTER TABLE hymns ADD COLUMN book_id INTEGER REFERENCES books(id)`);
      }

      // ── Seed default book for existing hymns ──
      const books = this.getAllBooks();
      if (books.length === 0) {
        this.db.run(`INSERT INTO books (name) VALUES (?)`, ['Methodist Hymn Book']);
        const book = this.queryOne(`SELECT id FROM books WHERE name = ?`, ['Methodist Hymn Book']);
        this.db.run(`UPDATE hymns SET book_id = ? WHERE book_id IS NULL`, [book.id]);
      }

      console.log('Connected to database:', dbPath);
    } catch (err) {
      console.error('Database connection failed:', err.message);
      throw err;
    }
  }

  run(sql, params = []) {
    this.db.run(sql, params);
  }

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

  queryOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // ── Books ────────────────────────────────────────────────
  getAllBooks() {
    return this.query(`SELECT id, name FROM books ORDER BY name ASC`);
  }

  addBook(name) {
    this.db.run(`INSERT INTO books (name) VALUES (?)`, [name]);
    return this.queryOne(`SELECT id, name FROM books WHERE name = ?`, [name]);
  }

  deleteBook(id) {
    // Unassign hymns from this book before deleting
    this.db.run(`UPDATE hymns SET book_id = NULL WHERE book_id = ?`, [id]);
    this.db.run(`DELETE FROM books WHERE id = ?`, [id]);
  }

  // ── Hymns ────────────────────────────────────────────────
  getAllHymns(bookId = null) {
    if (bookId) {
      return this.query(`
        SELECT id, number, title, author, book_id
        FROM hymns WHERE book_id = ?
        ORDER BY number ASC LIMIT 100
      `, [bookId]);
    }
    return this.query(`
      SELECT id, number, title, author, book_id
      FROM hymns ORDER BY number ASC LIMIT 100
    `);
  }

  searchByNumber(number, bookId = null) {
    if (bookId) {
      const result = this.queryOne(`
        SELECT id, number, title, author, book_id FROM hymns
        WHERE number = ? AND book_id = ?
      `, [number, bookId]);
      return result ? [result] : [];
    }
    const result = this.queryOne(`
      SELECT id, number, title, author, book_id FROM hymns WHERE number = ?
    `, [number]);
    return result ? [result] : [];
  }

  searchByTitle(query, bookId = null) {
    if (bookId) {
      return this.query(`
        SELECT id, number, title, author, book_id FROM hymns
        WHERE LOWER(title) LIKE LOWER(?) AND book_id = ?
        ORDER BY number ASC LIMIT 50
      `, [`%${query}%`, bookId]);
    }
    return this.query(`
      SELECT id, number, title, author, book_id FROM hymns
      WHERE LOWER(title) LIKE LOWER(?)
      ORDER BY number ASC LIMIT 50
    `, [`%${query}%`]);
  }

  addHymn({ number, title, author, bookId }) {
    this.db.run(
      `INSERT INTO hymns (number, title, author, book_id) VALUES (?, ?, ?, ?)`,
      [number, title, author || null, bookId]
    );
    return this.queryOne(
      `SELECT id, number, title, author, book_id FROM hymns WHERE rowid = last_insert_rowid()`
    );
  }

  updateHymn({ id, number, title, author, bookId }) {
    this.db.run(
      `UPDATE hymns SET number = ?, title = ?, author = ?, book_id = ? WHERE id = ?`,
      [number, title, author || null, bookId, id]
    );
  }

  deleteHymn(id) {
    this.db.run(`DELETE FROM hymn_blocks WHERE hymn_id = ?`, [id]);
    this.db.run(`DELETE FROM hymns WHERE id = ?`, [id]);
  }

  getHymnById(id) {
    return this.queryOne(`
      SELECT id, number, title, author, book_id FROM hymns WHERE id = ?
    `, [id]);
  }

  // ── Blocks ───────────────────────────────────────────────
  getHymnBlocks(hymnId) {
    return this.query(`
      SELECT id, hymn_id, position, type, label, text
      FROM hymn_blocks WHERE hymn_id = ?
      ORDER BY position ASC
    `, [hymnId]);
  }
}

module.exports = Database;