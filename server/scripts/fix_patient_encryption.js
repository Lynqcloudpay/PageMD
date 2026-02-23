const pool = require('../db.js');
const crypto = require('crypto');

async function fix() {
    try {
        await pool.query('SET search_path TO tenant_miami_cardiology_institute, public');

        const dekRes = await pool.query(`SELECT key_id, key_version, dek_encrypted FROM encryption_keys WHERE active = true ORDER BY created_at DESC LIMIT 1`);
        const row = dekRes.rows[0];

        // Decrypt the DEK from local appSecret (Local KMS implementation)
        const appSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
        const kmsClient = {
            decrypt: async (ciphertext) => {
                const key = crypto.scryptSync(appSecret, 'salt', 32);
                let dataString = ciphertext;
                if (Buffer.isBuffer(ciphertext)) dataString = ciphertext.toString('utf8');
                const parts = dataString.split(':');
                const iv = Buffer.from(parts[0], 'hex');
                const authTag = Buffer.from(parts[1], 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(parts[2], 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            }
        };

        const dekPlaintext = await kmsClient.decrypt(row.dek_encrypted);
        const dekBuffer = Buffer.from(dekPlaintext, 'base64');

        async function encryptDirectly(plaintext) {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv('aes-256-gcm', dekBuffer, iv);
            let ciphertext = cipher.update(plaintext, 'utf8');
            ciphertext = Buffer.concat([ciphertext, cipher.final()]);
            const authTag = cipher.getAuthTag();
            const combined = Buffer.concat([iv, authTag, ciphertext]);
            return {
                ciphertext: combined.toString('base64'),
                metadata: { keyId: row.key_id, keyVersion: row.key_version, algorithm: 'AES-256-GCM' }
            };
        }

        const encFName = await encryptDirectly('Arantxa');
        const encLName = await encryptDirectly('Estolt');
        const encCountry = await encryptDirectly('United States');

        const res = await pool.query(`SELECT encryption_metadata FROM tenant_miami_cardiology_institute.patients WHERE id = 'a01ff686-d21a-48e7-8925-4903740cdf38'`);
        let meta = res.rows[0].encryption_metadata;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        if (!meta) meta = {};

        meta.first_name = encFName.metadata;
        meta.last_name = encLName.metadata;
        meta.country = encCountry.metadata;

        await pool.query(
            `UPDATE tenant_miami_cardiology_institute.patients SET first_name = $1, last_name = $2, country = $3, encryption_metadata = $4 WHERE id = 'a01ff686-d21a-48e7-8925-4903740cdf38'`,
            [encFName.ciphertext, encLName.ciphertext, encCountry.ciphertext, JSON.stringify(meta)]
        );

        console.log('Successfully self-repaired patient encryption metadata.');
    } catch (e) {
        console.error('Error during script:', e);
    } finally {
        process.exit();
    }
}
fix();
