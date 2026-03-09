import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '', database: 'acinonyx_db' });
  try {
    await conn.query('DROP TABLE IF EXISTS `settings`');
    await conn.query('CREATE TABLE IF NOT EXISTS `settings` (`key` VARCHAR(255) PRIMARY KEY, value TEXT)');
    const [rows] = await conn.query("SHOW TABLES LIKE 'settings'");
    console.log('show tables like settings:', rows);
    try {
      const [selectRows] = await conn.query('SELECT * FROM `settings`');
      console.log('select ok', selectRows);
    } catch (err) {
      console.error('select error', err.message);
    }
  } finally {
    await conn.end();
  }
})();
