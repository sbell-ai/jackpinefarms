"use strict";
const { Pool } = require("/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js");
const fs = require("fs");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

const sqlContent = fs.readFileSync("backups/production-dump-20260408.sql", "utf8");

// Parse into individual statements (skip comment-only lines, split on semicolons)
const statements = sqlContent
  .split('\n')
  .filter(line => { const t = line.trim(); return t.length > 0 && !t.startsWith('--'); })
  .join('\n')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0)
  .map(s => s.endsWith(';') ? s : s + ';');

const insertStatements = statements.filter(s => s.startsWith('INSERT'));
const otherStatements = statements.filter(s => !s.startsWith('INSERT') && !s.startsWith('SELECT setval'));

console.log(`Parsed: ${statements.length} total statements`);
console.log(`  INSERT: ${insertStatements.length}`);
console.log(`  Other (SET etc): ${otherStatements.length}`);
console.log(`  SELECT setval: ${statements.filter(s => s.startsWith('SELECT setval')).length}`);
console.log("");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run() {
  const client = await pool.connect();
  try {
    // Test connection
    const test = await client.query("SELECT current_database(), current_user");
    console.log(`Connected to: ${test.rows[0].current_database} as ${test.rows[0].current_user}`);
    console.log("");

    const results = {};
    const errors = [];
    let successCount = 0;

    // Run all statements in order (SET + INSERTs + sequence resets)
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        const m = stmt.match(/^INSERT INTO (\w+)/);
        if (m) {
          results[m[1]] = (results[m[1]] || 0) + 1;
          successCount++;
        }
      } catch (err) {
        // ON CONFLICT DO NOTHING handles duplicates — only real errors matter
        if (!err.message.includes('ON CONFLICT') && !err.message.includes('duplicate key')) {
          errors.push({ stmt: stmt.slice(0, 100), error: err.message });
        }
      }
    }

    console.log("=== ROWS INSERTED BY TABLE ===");
    for (const [table, count] of Object.entries(results)) {
      console.log(`  ${table.padEnd(42)} ${count}`);
    }
    const totalInserted = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`${"  TOTAL INSERTED".padEnd(42)} ${totalInserted}`);

    if (errors.length > 0) {
      console.log("\n=== ERRORS ===");
      for (const e of errors) {
        console.log(`  STMT: ${e.stmt}`);
        console.log(`  ERR:  ${e.error}`);
      }
    } else {
      console.log("\nNo errors.");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
