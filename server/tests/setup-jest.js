/**
 * Jest Setup File
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.KMS_PROVIDER = 'local';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-encryption';

// Setup test database if available
const { setupTestDB } = require('./setup-test-db');

// Try to setup test DB, but don't fail if DB is not available
setupTestDB().catch(() => {
  console.log('⚠️  Test database not available - some tests may be skipped');
});





















