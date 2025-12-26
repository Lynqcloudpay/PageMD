const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Create the storage for the current tenant's pool
const dbStorage = new AsyncLocalStorage();

// Override DATE parser (OID 1082) to return date as string (YYYY-MM-DD)
// This prevents timezone-related date shifting (e.g. DOB shifting back one day)
types.setTypeParser(1082, (stringValue) => stringValue);

/**
 * Control Pool: Connects to the platform/tenant registry database.
 * Used exclusively by the TenantManager and Super Admin tools.
 */
const controlPool = new Pool({
  connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
});

/**
 * Default Pool: Used when no tenant is resolved (e.g. startup, health checks).
 */
const defaultPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 15000,
});

/**
 * The Proxy Object: This is what routes import via require('../db').
 * It dynamically routes queries to the correct tenant's pool using AsyncLocalStorage.
 */
const poolProxy = {
  get dbStorage() {
    return dbStorage;
  },

  // Helper to get the current pool from context
  get _currentPool() {
    const pool = dbStorage.getStore();
    if (!pool) {
      // If no tenant pool is in context, we use the default pool
      // In production, this might be a SuperAdmin or Shared DB depending on logic
      return defaultPool;
    }
    return pool;
  },

  // Proxy the most common pool methods
  query: (...args) => poolProxy._currentPool.query(...args),
  connect: (...args) => poolProxy._currentPool.connect(...args),
  on: (...args) => poolProxy._currentPool.on(...args),
  end: (...args) => poolProxy._currentPool.end(...args),

  // Expose the control pool for platform-level operations
  get controlPool() {
    return controlPool;
  }
};

module.exports = poolProxy;
