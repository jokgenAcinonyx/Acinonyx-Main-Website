import db from './database';

async function main() {
  try {
    await db.ensureSchema();
    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
