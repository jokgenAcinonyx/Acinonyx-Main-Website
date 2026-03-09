import fs from 'fs';

function parseTables(sql) {
  const tableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([^;]+?)\)\s*(ENGINE|$)/gis;
  const tables = {};
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const name = match[1];
    const body = match[2];
    const cols = [];
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('--'));
    for (const line of lines) {
      const colMatch = line.match(/^`?(\w+)`?\s+([^,]+)/);
      if (colMatch) cols.push(colMatch[1]);
    }
    tables[name] = cols;
  }
  return tables;
}

const mysqlSql = fs.readFileSync('database/acinonyx_db.sql', 'utf8');
const mysqlTables = parseTables(mysqlSql);

const tableNames = Object.keys(mysqlTables).sort();
console.log(`Found ${tableNames.length} tables in database/acinonyx_db.sql:`);
for (const name of tableNames) {
  console.log(`- ${name} (${mysqlTables[name].length} columns)`);
}
