const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Store the active database client (Transaction Wrapper)
const dbStorage = new AsyncLocalStorage();

// Override DATE parser
types.setTypeParser(1082, (stringValue) => stringValue);

const controlPoolConfig = (process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL)
  ? {
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

console.log(`[DB] Initializing Pool with host: ${controlPoolConfig.host || 'unknown'} and database: ${controlPoolConfig.database || 'unknown'}`);
if (controlPoolConfig.connectionString) {
  const maskedUrl = controlPoolConfig.connectionString.replace(/:[^:@]+@/, ':****@');
  console.log(`[DB] Initializing Pool with Connection String: ${maskedUrl}`);
}

const controlPool = new Pool({
  ...controlPoolConfig,
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
      return client.query(text, params);
    }

    // In production, fallback to controlPool is usually for global lookups.
    // If it happens during a clinical request, it might indicate context loss.
    if (process.env.NODE_ENV === 'production') {
      // console.warn(`[DB] Fallback to controlPool for query: ${text.substring(0, 50)}...`);
    }
    return controlPool.query(text, params);
  },

  // Helper to ensure we have a client for the current context
  getClient: () => {
    return dbStorage.getStore() || controlPool;
  },

  // Legacy/Pool compat methods
  connect: async (...args) => {
    const newClient = await controlPool.connect(...args);
    const store = dbStorage.getStore();
    if (store && store.tenantSchema) {
      // Propagation: Inherit search_path for manual connections (e.g. for transactions with isolation)
      // console.log(`[DB] Propagating search_path ${store.tenantSchema} to new connection`);
      await newClient.query(`SET search_path TO ${store.tenantSchema}, public`);
    }
    return newClient;
  },
  on: (...args) => controlPool.on(...args),
  end: (...args) => controlPool.end(...args),
};

module.exports = poolProxy;
