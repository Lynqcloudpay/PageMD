/**
 * MFA Service
 * 
 * Multi-Factor Authentication using TOTP (Time-based One-Time Password)
 * Compatible with Google Authenticator and similar apps
 */

const authenticator = require('otplib').authenticator;
const qrcode = require('qrcode');
const pool = require('../db');
const crypto = require('crypto');

class MFAService {
  /**
   * Generate TOTP secret for user
   * @param {string} userId - User ID
   * @param {string} email - User email (for QR code label)
   * @returns {Promise<{secret: string, qrCode: string}>}
   */
  async generateSecret(userId, email) {
    const secret = authenticator.generateSecret();
    const serviceName = process.env.MFA_SERVICE_NAME || 'PageMD EMR';
    
    // Store secret (encrypted) in database
    const encryptedSecret = this.encryptSecret(secret);
    
    await pool.query(`
      INSERT INTO user_mfa (user_id, method, secret, enabled, verified)
      VALUES ($1, 'totp', $2, false, false)
      ON CONFLICT (user_id, method) 
      DO UPDATE SET secret = EXCLUDED.secret, verified = false
    `, [userId, encryptedSecret]);
    
    // Generate QR code
    const otpauth = authenticator.keyuri(email, serviceName, secret);
    const qrCode = await qrcode.toDataURL(otpauth);
    
    return {
      secret, // Return plain secret for QR code generation (user should verify immediately)
      qrCode
    };
  }

  /**
   * Verify TOTP token
   * @param {string} userId - User ID
   * @param {string} token - TOTP token from authenticator app
   * @returns {Promise<boolean>} True if token is valid
   */
  async verifyToken(userId, token) {
    try {
      const result = await pool.query(
        'SELECT secret, enabled FROM user_mfa WHERE user_id = $1 AND method = $2',
        [userId, 'totp']
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const { secret: encryptedSecret, enabled } = result.rows[0];
      
      if (!enabled) {
        return false;
      }
      
      const secret = this.decryptSecret(encryptedSecret);
      const isValid = authenticator.check(token, secret);
      
      return isValid;
    } catch (error) {
      console.error('MFA verification error:', error);
      return false;
    }
  }

  /**
   * Enable MFA for user (after verification)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async enableMFA(userId) {
    await pool.query(
      'UPDATE user_mfa SET enabled = true, verified = true WHERE user_id = $1 AND method = $2',
      [userId, 'totp']
    );
  }

  /**
   * Disable MFA for user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async disableMFA(userId) {
    await pool.query(
      'UPDATE user_mfa SET enabled = false WHERE user_id = $1 AND method = $2',
      [userId, 'totp']
    );
  }

  /**
   * Check if MFA is enabled for user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isMFAEnabled(userId) {
    const result = await pool.query(
      'SELECT enabled FROM user_mfa WHERE user_id = $1 AND method = $2 AND enabled = true',
      [userId, 'totp']
    );
    return result.rows.length > 0;
  }

  /**
   * Encrypt MFA secret before storing (using app secret)
   * @param {string} secret - Plain TOTP secret
   * @returns {string} Encrypted secret
   */
  encryptSecret(secret) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt MFA secret
   * @param {string} encryptedSecret - Encrypted secret
   * @returns {string} Plain TOTP secret
   */
  decryptSecret(encryptedSecret) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = new MFAService();





