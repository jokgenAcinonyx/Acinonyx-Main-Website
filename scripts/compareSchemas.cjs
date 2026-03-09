const fs = require('fs');

function parseTables(sql) {
  const tableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([^;]+?)\)\s*(ENGINE|$)/gis;
  const tables = {};
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const name = match[1];
    const body = match[2];
    const cols = [];
    const lines = body
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(
        l =>
          l &&
          !l.startsWith('--') &&
          !l.toUpperCase().startsWith('FOREIGN') &&
          !l.toUpperCase().startsWith('CONSTRAINT')
      );
    for (const line of lines) {
      const colMatch = line.match(/^`?(\w+)`?\s+([^,]+)/);
      if (colMatch) cols.push(colMatch[1]);
    }
    tables[name] = cols;
  }
  return tables;
}

function parseCreateIfNotExists(sql) {
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?\s*\(([^;]+?)\);/gis;
  const tables = {};
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const name = match[1];
    const body = match[2];
    const cols = [];
    const lines = body
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(
        l =>
          l &&
          !l.startsWith('--') &&
          !l.toUpperCase().startsWith('FOREIGN') &&
          !l.toUpperCase().startsWith('CONSTRAINT')
      );
    for (const line of lines) {
      const colMatch = line.match(/^`?(\w+)`?\s+([^,]+)/);
      if (colMatch) cols.push(colMatch[1]);
    }
    tables[name] = cols;
  }
  return tables;
}

const sqliteSql = fs.readFileSync('database.ts', 'utf8');
const mysqlSql = fs.readFileSync('database/acinonyx_db.sql', 'utf8');

const sqliteTables = parseCreateIfNotExists(sqliteSql);
const mysqlTables = parseTables(mysqlSql);

const allTableNames = new Set([...Object.keys(sqliteTables), ...Object.keys(mysqlTables)]);

const outputLines = [];
outputLines.push(`sqlite tables: ${Object.keys(sqliteTables).length}`);
outputLines.push(`mysql tables: ${Object.keys(mysqlTables).length}`);
outputLines.push(`total union tables: ${allTableNames.size}`);

for (const tableName of [...allTableNames].sort()) {
  const sqliteCols = sqliteTables[tableName] || [];
  const mysqlCols = mysqlTables[tableName] || [];
  const onlyInSqlite = sqliteCols.filter(c => !mysqlCols.includes(c));
  const onlyInMysql = mysqlCols.filter(c => !sqliteCols.includes(c));
  if (onlyInSqlite.length || onlyInMysql.length) {
    outputLines.push(`--- ${tableName}`);
    if (onlyInSqlite.length) outputLines.push(`  only in sqlite schema: ${JSON.stringify(onlyInSqlite)}`);
    if (onlyInMysql.length) outputLines.push(`  only in mysql dump: ${JSON.stringify(onlyInMysql)}`);
  }
}

fs.writeFileSync('schema-diff.txt', outputLines.join('\n'));
