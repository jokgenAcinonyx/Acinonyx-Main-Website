import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '', database: 'acinonyx_db' });
  try {
    const [dbRow] = await conn.query('SELECT DATABASE() AS db');
    console.log('connected DB:', dbRow);

    await conn.query(`CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      value TEXT
    )`);

    const [rowsAfter] = await conn.query("SHOW TABLES LIKE 'settings'");
    console.log('settings table exists after create attempt:', rowsAfter);

    // Try selecting from the table to confirm it works
    try {
      const [selectRows] = await conn.query('SELECT * FROM settings LIMIT 1');
      console.log('select from settings:', selectRows);
    } catch (err) {
      console.error('select error on settings:', err.message || err);
    }
  } catch (err) {
    console.error('error creating settings', err);
  } finally {
    await conn.end();
  }
})();
