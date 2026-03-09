import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({ host:'127.0.0.1', port: 3307, user: 'root', password: '', database: 'acinonyx_db' });
  const [rows] = await conn.query("SHOW TABLES LIKE 'settings'");
  console.log('settings table rows:', rows);
  if (rows.length) {
    const [r2] = await conn.query('SHOW CREATE TABLE `settings`');
    console.log('CREATE TABLE settings:', r2[0]);
    const [r3] = await conn.query('SELECT * FROM settings LIMIT 5');
    console.log('settings sample rows:', r3);
  }
  await conn.end();
})();
