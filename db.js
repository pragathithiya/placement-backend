const { Pool } = require('pg');
require('dotenv').config();

let db;
const connectionString = process.env.DATABASE_URL;

function getDb() {
  if (db) return db;

  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL is missing in .env.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  // Refined DB interface for PostgreSQL compatibility
  db = {
    prepare: (sql) => {
      return {
        all: async (params = []) => {
          const res = await pool.query(sql, Array.isArray(params) ? params : [params]);
          return res.rows;
        },
        get: async (params = []) => {
          const res = await pool.query(sql, Array.isArray(params) ? params : [params]);
          return res.rows[0];
        },
        run: async (params = []) => {
          await pool.query(sql, Array.isArray(params) ? params : [params]);
          return { changes: 1 };
        }
      };
    },
    exec: async (sql) => {
      await pool.query(sql);
    }
  };

  // Initialize Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS placements (
      id TEXT PRIMARY KEY,
      image_path TEXT,
      company_name TEXT,
      extracted_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      placement_id TEXT,
      role TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(() => console.log("✅ Cloud Database Connected & Initialized."))
    .catch(err => console.error("Cloud DB Init error:", err));

  return db;
}

module.exports = { getDb };
