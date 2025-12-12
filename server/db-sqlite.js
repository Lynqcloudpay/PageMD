// SQLite database connection (alternative to PostgreSQL)
// This requires no database server - just works!

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'paper_emr.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Export a pool-like interface for compatibility
const pool = {
  query: (text, params = []) => {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(text);
        const result = stmt.all(...params);
        resolve({ rows: result });
      } catch (error) {
        reject(error);
      }
    });
  },
  connect: () => Promise.resolve({ release: () => {} }),
};

module.exports = pool;

































