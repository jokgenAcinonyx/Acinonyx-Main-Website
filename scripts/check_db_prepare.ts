import db from '../server/database';

(async () => {
  const accounts = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(1);
  console.log('db.prepare returned', accounts);
  console.log('is array?', Array.isArray(accounts));
})();
