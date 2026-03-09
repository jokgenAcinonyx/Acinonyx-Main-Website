import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '', database: 'acinonyx_db' });
  try {
    await conn.query('CREATE TABLE IF NOT EXISTS test_create (id INT PRIMARY KEY)');
    const [rows] = await conn.query("SHOW TABLES LIKE 'test_create'");
    console.log('test_create exists (show tables):', rows);
    try {
      const [selectRows] = await conn.query('SELECT * FROM test_create');
      console.log('select succeeded, row count:', selectRows.length);
    } catch (err) {
      console.error('select error', err.message);
    }
  } finally {
    await conn.end();
  }
})();
