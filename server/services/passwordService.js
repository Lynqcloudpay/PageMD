/**
 * Password Service
 * 
 * HIPAA-compliant password hashing using Argon2id
 */

const argon2 = require('argon2');

class PasswordService {
  /**
   * Hash password using Argon2id (HIPAA-compliant)
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      // Argon2id with balanced parameters for performance and security
      // Reduced memoryCost for faster verification while maintaining security
      // memoryCost: 16384 (16 MB) - balanced for performance
      // timeCost: 2 - number of iterations (reduced for speed)
      // parallelism: 2 - number of threads (reduced for speed)
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 16384, // 16 MB (reduced from 64 MB for better performance)
        timeCost: 2, // Reduced from 3 for faster verification
        parallelism: 2, // Reduced from 4 for faster verification
        hashLength: 32
      });
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   * @param {string} hash - Hashed password
   * @param {string} password - Plain text password to verify
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(hash, password) {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Check if hash needs rehashing (if parameters changed)
   * @param {string} hash - Current hash
   * @returns {boolean} True if hash should be rehashed
   */
  needsRehash(hash) {
    // Argon2 hashes include parameters, so we can check if they match current settings
    // For now, we'll rehash if the hash doesn't start with $argon2id
    return !hash.startsWith('$argon2id$');
  }
}

module.exports = new PasswordService();


















