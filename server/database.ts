import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'async_hooks';

// Load environment variables (.env) for database configuration.
dotenv.config();

const DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT ?? 3307);
const DB_USER = process.env.DB_USER ?? 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const DB_NAME = process.env.DB_NAME ?? 'acinonyx_db';
const DB_CONNECTION_LIMIT = Number(process.env.DB_CONNECTION_LIMIT ?? 10);

function resolveRoot(...parts: string[]) {
  return path.resolve(process.cwd(), ...parts);
}

// Create an admin pool (no database selected) to ensure the database exists before we connect.
const adminPool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: 0,
  multipleStatements: true,
});

// Ensure the target database exists.
async function ensureDatabaseExists() {
  try {
    await adminPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );
  } catch (err) {
    console.warn('[DB] Failed to ensure database exists:', err);
  }
}

let pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: 0,
  multipleStatements: true,
});

// AsyncLocalStorage used to scope a connection to a transaction.
const transactionStorage = new AsyncLocalStorage<mysql.PoolConnection>();

function getConnection() {
  return transactionStorage.getStore() ?? pool;
}

// Ini adalah "Kurir" yang akan kita pakai di file lain
export const db = {
  pool,

  // Fungsi untuk menjalankan perintah SQL (SELECT, INSERT, UPDATE, DELETE)
  async query(sql: string, ...params: any[]) {
    try {
      const conn = getConnection();
      const [results] = await conn.execute(sql, params);
      return results;
    } catch (error) {
      console.error('[MySQL Error]:', error);
      throw error;
    }
  },

  async get<T = any>(sql: string, ...params: any[]) {
    const results = await this.query(sql, ...params);
    if (Array.isArray(results)) return (results[0] as T) || null;
    return null;
  },

  async all<T = any>(sql: string, ...params: any[]) {
    const results = await this.query(sql, ...params);
    if (Array.isArray(results)) return results as T[];
    return [] as T[];
  },

  async run(sql: string, ...params: any[]) {
    const conn = getConnection();
    const [result] = await conn.execute(sql, params);
    return result as any;
  },

  // Run a SQL file containing multiple statements (e.g. dump file)
  async runSqlFile(filePath: string) {
    const absolutePath = resolveRoot(filePath);
    const rawSql = await fs.readFile(absolutePath, 'utf8');
    await pool.query(rawSql);
  },

  prepare(sql: string) {
    return {
      run: (...params: any[]) => this.run(sql, ...params),
      get: (...params: any[]) => this.get(sql, ...params),
      all: (...params: any[]) => this.all(sql, ...params),
    };
  },

  /**
   * Creates a transaction wrapper that runs the callback within a MySQL transaction.
   * This mimics better-sqlite3's `db.transaction(fn)()` API used in the codebase.
   */
  transaction<T extends any[]>(fn: (...args: T) => any) {
    return async (...args: T) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        return await transactionStorage.run(conn, async () => {
          const result = await fn(...args);
          await conn.commit();
          return result;
        });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    };
  },

  /**
   * Ensure the database schema is present by importing the SQL dump if needed.
   * This helps avoid runtime errors when the MySQL database is empty.
   */
  async ensureSchema() {
    try {
      // Make sure the target database exists before doing anything else.
      await ensureDatabaseExists();

      const sqlDumpPath = resolveRoot('database', 'acinonyx_db.sql');
      const sqlDump = await fs.readFile(sqlDumpPath, 'utf8');

      // Determine the expected schema from the dump file.
      const expectedTables = new Set<string>();
      for (const match of [...sqlDump.matchAll(/CREATE\s+TABLE\s+`([^`]+)`/gi)]) {
        expectedTables.add(match[1]);
      }

      // Check what tables exist currently.
      const [existingRows] = await pool.query(
        'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?',
        [DB_NAME]
      ) as any[];
      const existingTables = new Set(existingRows.map((r: any) => r.TABLE_NAME));

      const missing = [...expectedTables].filter((t) => !existingTables.has(t));

      // If any expected tables are missing, or any expected table is corrupted, rebuild.
      let needRebuild = missing.length > 0;
      if (!needRebuild) {
        for (const tableName of expectedTables) {
          try {
            await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
          } catch (err: any) {
            needRebuild = true;
            console.warn('[DB] Detected corrupted table schema:', tableName, err?.message || err);
            break;
          }
        }
      }

      if (needRebuild) {
        console.log('[DB] Detected missing/corrupted schema. Rebuilding database from dump.',
          missing.length ? { missing } : undefined);

        // Close any existing connections that might be holding locks / corrupted tables.
        try {
          await pool.end();
        } catch {
          // ignore errors while closing
        }

        // Recreate the database from scratch.
        await adminPool.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
        await adminPool.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);

        // Recreate the pool so it connects to the fresh database.
        pool = mysql.createPool({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          waitForConnections: true,
          connectionLimit: DB_CONNECTION_LIMIT,
          queueLimit: 0,
          multipleStatements: true,
        });
        // Keep the exported pool reference in sync.
        (db as any).pool = pool;

        // Sanity check: ensure the database is empty before importing the dump.
        try {
          const [rows] = await pool.query('SHOW TABLES');
          console.log('[DB] Tables present after recreating DB (should be empty):', rows);
        } catch (err) {
          console.warn('[DB] Failed to list tables after recreating DB:', err);
        }

        // Import the dump statement-by-statement so we can recover from partial imports.
        // MariaDB/MySQL treats DDL as auto-committing, so the dump's embedded
        // transactions (START TRANSACTION/COMMIT) cannot be rolled back if import fails.
        const importConn = await mysql.createConnection({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          multipleStatements: true,
        });

        const statements = sqlDump
          .split(/;\s*\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        for (const stmt of statements) {
          // The dump contains transaction markers that we can safely ignore.
          if (/^START\s+TRANSACTION/i.test(stmt) || /^COMMIT/i.test(stmt)) {
            continue;
          }

          // Ensure we always start from a clean slate for CREATE TABLE statements.
          const createMatch = stmt.match(/CREATE\s+TABLE\s+`([^`]+)`/i);
          if (createMatch) {
            const tableName = createMatch[1];
            try {
              await importConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            } catch (err: any) {
              console.warn('[DB] Failed to drop table before create:', tableName, err?.message || err);
            }
          }

          try {
            await importConn.query(stmt);
          } catch (err: any) {
            // When the table is in a bad state (e.g., "doesn't exist in engine"),
            // dropping and retrying often helps.
            if (err?.code === 'ER_TABLE_EXISTS_ERROR' || err?.errno === 1932) {
              const tableMatch = stmt.match(/(?:CREATE|ALTER)\s+TABLE\s+`([^`]+)`/i);
              if (tableMatch) {
                const tableName = tableMatch[1];
                try {
                  await importConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
                  await importConn.query(stmt);
                  continue;
                } catch (innerErr: any) {
                  console.warn('[DB] Still failing after trying to drop table:', tableName, innerErr?.message || innerErr);
                }
              }
            }

            console.warn('[DB] Failed to execute statement during import:', err?.message || err);
          }
        }

        // Ensure the admin settings table exists after rebuilding.
        try {
          await importConn.query(`CREATE TABLE IF NOT EXISTS settings (
            \`key\` VARCHAR(255) PRIMARY KEY,
            value TEXT
          )`);
        } catch (err: any) {
          console.warn('[DB] Failed to ensure settings table exists after rebuild:', err?.message || err);
        }

        await importConn.end();
        console.log('[DB] Database rebuilt from dump.');
        return;
      }

      // Otherwise, schema exists and seems valid. Ensure auxiliary tables exist.
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS settings (
          \`key\` VARCHAR(255) PRIMARY KEY,
          value TEXT
        )`);
      } catch (err: any) {
        console.warn('[DB] Failed to ensure settings table exists:', err?.message || err);
      }
    } catch (err) {
      console.warn('[DB] Failed to ensure schema exists:', err);
    }
  },
};

// `mysql2/promise` pool does not expose `.prepare().run()` signatures used in server.ts.
// Casting to `any` so that existing code compiles, though runtime may need adjustment.
export default db;