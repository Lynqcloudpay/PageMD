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
      // Argon2id with recommended parameters for HIPAA compliance
      // memoryCost: 65536 (64 MB) - higher than default for better security
      // timeCost: 3 - number of iterations
      // parallelism: 4 - number of threads
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
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





