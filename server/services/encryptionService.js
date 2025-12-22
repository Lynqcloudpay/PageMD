/**
 * Encryption Service
 * 
 * HIPAA-compliant field-level encryption using envelope encryption:
 * - Data Encryption Key (DEK) per tenant/environment
 * - DEK encrypted with KMS Master Encryption Key (MEK)
 * - AES-256-GCM for field encryption
 */

const crypto = require('crypto');
const pool = require('../db');

// DEK Cache to prevent repeated DB/KMS calls
// keyId -> { dek: Buffer, expires: Number }
const dekCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// KMS client (abstracted - supports AWS KMS, GCP KMS, Azure Key Vault)
let kmsClient = null;

/**
 * Initialize KMS client based on environment
 */
const getKMSClient = () => {
  if (kmsClient) return kmsClient;

  const kmsProvider = process.env.KMS_PROVIDER || 'local'; // 'aws', 'gcp', 'azure', 'local'

  if (kmsProvider === 'aws') {
    // AWS KMS
    const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');
    kmsClient = {
      client: new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' }),
      keyId: process.env.AWS_KMS_KEY_ID,
      encrypt: async (plaintext) => {
        const command = new EncryptCommand({
          KeyId: kmsClient.keyId,
          Plaintext: Buffer.from(plaintext)
        });
        const response = await kmsClient.client.send(command);
        return response.CiphertextBlob;
      },
      decrypt: async (ciphertextBlob) => {
        const command = new DecryptCommand({
          CiphertextBlob: ciphertextBlob
        });
        const response = await kmsClient.client.send(command);
        return response.Plaintext.toString();
      }
    };
  } else if (kmsProvider === 'gcp') {
    // GCP KMS
    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    kmsClient = {
      client: new KeyManagementServiceClient(),
      projectId: process.env.GCP_PROJECT_ID,
      locationId: process.env.GCP_LOCATION_ID || 'us-east1',
      keyRingId: process.env.GCP_KEY_RING_ID,
      cryptoKeyId: process.env.GCP_CRYPTO_KEY_ID,
      encrypt: async (plaintext) => {
        const name = kmsClient.client.cryptoKeyPath(
          kmsClient.projectId,
          kmsClient.locationId,
          kmsClient.keyRingId,
          kmsClient.cryptoKeyId
        );
        const [result] = await kmsClient.client.encrypt({
          name,
          plaintext: Buffer.from(plaintext)
        });
        return result.ciphertext;
      },
      decrypt: async (ciphertext) => {
        const name = kmsClient.client.cryptoKeyPath(
          kmsClient.projectId,
          kmsClient.locationId,
          kmsClient.keyRingId,
          kmsClient.cryptoKeyId
        );
        const [result] = await kmsClient.client.decrypt({
          name,
          ciphertext
        });
        return result.plaintext.toString();
      }
    };
  } else if (kmsProvider === 'azure') {
    // Azure Key Vault
    const { KeyClient, CryptographyClient } = require('@azure/keyvault-keys');
    const { DefaultAzureCredential } = require('@azure/identity');
    const credential = new DefaultAzureCredential();
    kmsClient = {
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
      keyName: process.env.AZURE_KEY_NAME,
      encrypt: async (plaintext) => {
        const cryptoClient = new CryptographyClient(
          `${kmsClient.keyVaultUrl}/keys/${kmsClient.keyName}`,
          credential
        );
        const result = await cryptoClient.encrypt('RSA-OAEP', Buffer.from(plaintext));
        return result.result;
      },
      decrypt: async (ciphertext) => {
        const cryptoClient = new CryptographyClient(
          `${kmsClient.keyVaultUrl}/keys/${kmsClient.keyName}`,
          credential
        );
        const result = await cryptoClient.decrypt('RSA-OAEP', ciphertext);
        return result.result.toString();
      }
    };
  } else {
    // Local/Development: Use app secret (NOT for production enterprise, but OK for small clinics)
    // Allow local KMS on localhost, Docker container hostnames, or explicit override
    const isLocalOrDocker = process.env.DB_HOST === 'localhost' ||
      process.env.DB_HOST === '127.0.0.1' ||
      process.env.DB_HOST === 'db' ||  // Docker service name
      !process.env.DB_HOST ||
      process.env.ALLOW_LOCAL_KMS === 'true';

    if (process.env.NODE_ENV === 'production' && kmsProvider === 'local' && !isLocalOrDocker) {
      throw new Error('KMS_PROVIDER=local is not allowed in production. Use AWS KMS, GCP KMS, or Azure Key Vault, or set ALLOW_LOCAL_KMS=true.');
    }
    const appSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    kmsClient = {
      encrypt: async (plaintext) => {
        const key = crypto.scryptSync(appSecret, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Return as Buffer with format: iv:authTag:encrypted (all as hex)
        const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        return Buffer.from(combined, 'utf8');
      },
      decrypt: async (ciphertext) => {
        const key = crypto.scryptSync(appSecret, 'salt', 32);
        // Handle Buffer input - convert to utf8 string (format: "iv:authTag:encrypted")
        let dataString;
        if (Buffer.isBuffer(ciphertext)) {
          dataString = ciphertext.toString('utf8');
        } else {
          dataString = ciphertext.toString('utf8');
        }

        const parts = dataString.split(':');
        if (parts.length !== 3) {
          throw new Error('Invalid ciphertext format');
        }

        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        // Return as string (base64) not Buffer
        return decrypted;
      }
    };
  }

  return kmsClient;
};

/**
 * Get or create Data Encryption Key (DEK)
 * DEK is encrypted with KMS and stored in database
 */
/**
 * Get or create Data Encryption Key (DEK)
 * DEK is encrypted with KMS and stored in database
 */
const getDEK = async () => {
  try {
    const now = Date.now();

    // Check active key cache
    // We don't easily know which key is active without querying, 
    // but we can query mostly for the ID and see if we have it cached.
    // However, for encryption (writing), we want the LATEST active key.
    // A short cache (e.g. 1 min) for the "active key ID" could work,
    // but let's just cache the DEK *content* once we have the ID.

    // 1. Get active DEK metadata (fast query)
    const result = await pool.query(`
      SELECT id, key_id, key_version, dek_encrypted, algorithm
      FROM encryption_keys
      WHERE active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];

      // Check cache for this specific key
      if (dekCache.has(row.key_id)) {
        const cached = dekCache.get(row.key_id);
        if (cached.expires > now) {
          return {
            id: row.id,
            keyId: row.key_id,
            keyVersion: row.key_version,
            dek: cached.dek,
            algorithm: row.algorithm
          };
        }
      }

      const kms = getKMSClient();

      // Decrypt DEK with KMS (works for both test and production)
      const dekPlaintext = await kms.decrypt(row.dek_encrypted);

      // KMS decrypt returns string (base64), convert to Buffer
      const dekBase64 = typeof dekPlaintext === 'string' ? dekPlaintext : dekPlaintext.toString('utf8');
      const dekBuffer = Buffer.from(dekBase64, 'base64');

      // Cache it
      dekCache.set(row.key_id, {
        dek: dekBuffer,
        expires: now + CACHE_TTL
      });

      return {
        id: row.id,
        keyId: row.key_id,
        keyVersion: row.key_version,
        dek: dekBuffer,
        algorithm: row.algorithm
      };
    }

    // Create new DEK
    const dek = crypto.randomBytes(32); // 256 bits for AES-256
    const dekBase64 = dek.toString('base64');

    // Encrypt DEK with KMS
    const kms = getKMSClient();
    const dekEncrypted = await kms.encrypt(dekBase64);

    // Store encrypted DEK
    const keyId = `dek-${Date.now()}`;
    const keyVersion = '1';

    const insertResult = await pool.query(`
      INSERT INTO encryption_keys (key_id, key_version, dek_encrypted, algorithm, active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, key_id, key_version
    `, [keyId, keyVersion, dekEncrypted, 'AES-256-GCM']);

    // Cache the new key
    dekCache.set(keyId, {
      dek: dek,
      expires: now + CACHE_TTL
    });

    return {
      id: insertResult.rows[0].id,
      keyId: insertResult.rows[0].key_id,
      keyVersion: insertResult.rows[0].key_version,
      dek: dek,
      algorithm: 'AES-256-GCM'
    };
  } catch (error) {
    console.error('Error getting DEK:', error);
    throw new Error('Failed to get encryption key');
  }
};

class EncryptionService {
  /**
   * Encrypt field value
   * @param {string} plaintext - Plain text to encrypt
   * @returns {Promise<{ciphertext: Buffer, iv: Buffer, authTag: Buffer, keyId: string, keyVersion: string}>}
   */
  async encryptField(plaintext) {
    if (!plaintext) return null;

    try {
      const dek = await getDEK();
      const iv = crypto.randomBytes(12); // 96 bits for GCM

      const cipher = crypto.createCipheriv('aes-256-gcm', dek.dek, iv);
      let ciphertext = cipher.update(plaintext, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const authTag = cipher.getAuthTag();

      return {
        ciphertext,
        iv,
        authTag,
        keyId: dek.keyId,
        keyVersion: dek.keyVersion
      };
    } catch (error) {
      console.error('Field encryption error:', error);
      throw new Error('Failed to encrypt field');
    }
  }

  /**
   * Decrypt field value
   * @param {Buffer} ciphertextBlob - Encrypted data blob
   * @param {Buffer} iv - Initialization vector
   * @param {Buffer} authTag - Authentication tag
   * @param {string} keyId - Key ID (optional, uses active key if not provided)
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decryptField(ciphertextBlob, iv, authTag, keyId = null) {
    if (!ciphertextBlob || !iv || !authTag) return null;

    try {
      let dek;

      if (keyId) {
        // Check cache first
        const now = Date.now();
        if (dekCache.has(keyId)) {
          const cached = dekCache.get(keyId);
          if (cached.expires > now) {
            dek = cached.dek;
          }
        }

        if (!dek) {
          // Get specific DEK
          const result = await pool.query(`
            SELECT dek_encrypted FROM encryption_keys WHERE key_id = $1
          `, [keyId]);

          if (result.rows.length === 0) {
            throw new Error('Encryption key not found');
          }

          const kms = getKMSClient();
          const dekPlaintext = await kms.decrypt(result.rows[0].dek_encrypted);

          // Use Buffer directly for AES-GCM
          const dekBase64 = typeof dekPlaintext === 'string' ? dekPlaintext : dekPlaintext.toString('utf8');
          dek = Buffer.from(dekBase64, 'base64');

          // Cache it
          dekCache.set(keyId, {
            dek: dek,
            expires: now + CACHE_TTL
          });
        }
      } else {
        // Use active DEK
        const dekData = await getDEK();
        dek = dekData.dek;
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(ciphertextBlob);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error) {
      console.error('Field decryption error:', error);
      throw new Error('Failed to decrypt field');
    }
  }

  /**
   * Encrypt field and return as base64 string for database storage
   * @param {string} plaintext - Plain text to encrypt
   * @returns {Promise<string>} Base64-encoded encrypted blob
   */
  async encryptFieldToBase64(plaintext) {
    if (!plaintext) return null;

    const encrypted = await this.encryptField(plaintext);

    // Combine iv:authTag:ciphertext:keyId:keyVersion
    const combined = Buffer.concat([
      encrypted.iv,
      encrypted.authTag,
      encrypted.ciphertext
    ]);

    // Store metadata separately in encryption_metadata JSONB column
    const metadata = {
      keyId: encrypted.keyId,
      keyVersion: encrypted.keyVersion,
      algorithm: 'AES-256-GCM'
    };

    return {
      ciphertext: combined.toString('base64'),
      metadata
    };
  }

  /**
   * Decrypt field from base64 string
   * @param {string} base64Blob - Base64-encoded encrypted blob
   * @param {object} metadata - Encryption metadata with keyId
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decryptFieldFromBase64(base64Blob, metadata) {
    if (!base64Blob || !metadata) return null;

    const combined = Buffer.from(base64Blob, 'base64');

    // Extract components
    const iv = combined.slice(0, 12);
    const authTag = combined.slice(12, 28);
    const ciphertext = combined.slice(28);

    return await this.decryptField(ciphertext, iv, authTag, metadata.keyId);
  }

  /**
   * Rotate encryption key (re-encrypt all fields with new DEK)
   * @returns {Promise<{oldKeyId: string, newKeyId: string, recordsUpdated: number}>}
   */
  async rotateKey() {
    // This is a complex operation that should be run as a script
    // See scripts/rotate-encryption-keys.js
    throw new Error('Key rotation must be performed via dedicated script');
  }
}

module.exports = new EncryptionService();

