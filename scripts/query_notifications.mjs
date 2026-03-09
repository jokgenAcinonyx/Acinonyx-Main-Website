import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '', database: 'acinonyx_db' });
  const [rows] = await conn.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [1]);
  console.log('rows is array?', Array.isArray(rows));
  console.log('rows:', rows);
  await conn.end();
})();
