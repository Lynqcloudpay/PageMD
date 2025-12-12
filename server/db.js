const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process - log the error and let the pool handle reconnection
  // The pool will automatically retry connections
});

// Monitor connection pool health
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('🔌 POOL STATUS:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
    if (pool.waitingCount > 0) {
      console.warn('⚠️ WARNING: Connection pool has waiting requests - possible connection leak!');
    }
  }, 10000); // Every 10 seconds
}

module.exports = pool;



