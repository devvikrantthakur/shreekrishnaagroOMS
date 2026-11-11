const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function requireFromBackend(pkg) {
  return require(require.resolve(pkg, {
    paths: [__dirname, path.resolve(__dirname, '../backend/node_modules')],
  }));
}

const mysql = requireFromBackend('mysql2/promise');

function loadEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const candidates = isProd
    ? [
        path.resolve(__dirname, '../backend/.env.production'),
        path.resolve(__dirname, '../.env.production'),
        path.resolve(__dirname, '../backend/.env'),
        path.resolve(__dirname, '../.env'),
      ]
    : [
        path.resolve(__dirname, '../backend/.env'),
        path.resolve(__dirname, '../.env'),
      ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      requireFromBackend('dotenv').config({ path: envPath });
      return;
    }
  }
}

loadEnv();

async function runMigrations() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'shri_krishna_agro';

  const adminConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await adminConn.end();
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
      .sort();

    const [appliedRows] = await conn.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }
      const fullPath = path.join(migrationsDir, file);
      console.log(`Applying migration: ${file}...`);
      if (file.endsWith('.sql')) {
        const sql = fs.readFileSync(fullPath, 'utf8');
        await conn.query(sql);
      } else if (file.endsWith('.js')) {
        const mod = require(fullPath);
        await mod.up(conn, database);
      }
      await conn.query('INSERT INTO schema_migrations (id, filename) VALUES (?, ?)', [
        crypto.randomUUID(),
        file,
      ]);
      console.log(`Applied migration: ${file}`);
    }

    console.log('All migrations completed successfully.');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
