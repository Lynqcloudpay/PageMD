const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Store the active database client (Transaction Wrapper)
const dbStorage = new AsyncLocalStorage();

// Override DATE parser
types.setTypeParser(1082, (stringValue) => stringValue);

/**
 * Control Pool: Main entry point for the application.
 * Used for:
 * 1. Control queries (clinics table)
 * 2. Acquiring clients for tenant transactions
 */
const controlPool = new Pool({
  connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Increased for transaction handling
  idleTimeoutMillis: 30000,
});

/**
 * The Proxy Object:
 * Automatically routes queries to the active transaction client if one exists.
 * Otherwise, falls back to the control pool (for global lookups).
 */
const poolProxy = {
  get dbStorage() {
    return dbStorage;
  },

  get controlPool() {
    return controlPool;
  },

  // Helper to get the current transactional client
  get _currentClient() {
    return dbStorage.getStore();
  },

  query: async (text, params) => {
    const client = dbStorage.getStore();
    if (client) {
      // console.log(`[DB] Using transactional client for query: ${text.substring(0, 50)}...`);
      return client.query(text, params);
    }
    // console.log(`[DB] Falling back to controlPool for query: ${text.substring(0, 50)}...`);
    return controlPool.query(text, params);
  },

  // Legacy/Pool compat methods
  connect: (...args) => controlPool.connect(...args),
  on: (...args) => controlPool.on(...args),
  end: (...args) => controlPool.end(...args),
};

module.exports = poolProxy;
