const { Pool, types } = require('pg');
require('dotenv').config();

// Override DATE parser (OID 1082) to return date as string (YYYY-MM-DD)
// This prevents timezone-related date shifting (e.g. DOB shifting back one day)
types.setTypeParser(1082, (stringValue) => stringValue);

// Use DATABASE_URL if available (production), otherwise use individual env vars
const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Allow self-signed certificates
    },
    // Keep a modest pool size; too many connections can hurt small instances
    max: 10,
    // Close idle connections a bit sooner to avoid stale sockets
    idleTimeoutMillis: 15000,
    // Give the DB more time to accept new connections to avoid spurious timeouts
    connectionTimeoutMillis: 15000,
  })
  : new Pool({
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



