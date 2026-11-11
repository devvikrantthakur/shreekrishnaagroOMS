const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connection pool established.');

    app.listen(env.port, () => {
      console.log(`Shree Krishna Agro OMS API running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
}

startServer();
