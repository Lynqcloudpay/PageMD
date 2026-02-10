const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

/**
 * PageMD Archive Decryption Utility
 * 
 * Usage:
 * node decrypt-archive.js --file <path-to-enc-file> --out <path-to-output-sql>
 * 
 * Requirements:
 * - BACKUP_ENCRYPTION_KEY must be set in shell or .env
 */

async function decryptArchive() {
    // 1. Parse Arguments
    const args = process.argv.slice(2);
    const fileArgIndex = args.indexOf('--file');
    const outArgIndex = args.indexOf('--out');

    if (fileArgIndex === -1 || !args[fileArgIndex + 1]) {
        console.error('❌ Missing required argument: --file <path>');
        process.exit(1);
    }

    if (outArgIndex === -1 || !args[outArgIndex + 1]) {
        console.error('❌ Missing required argument: --out <path>');
        process.exit(1);
    }

    const inputPath = path.resolve(args[fileArgIndex + 1]);
    const outputPath = path.resolve(args[outArgIndex + 1]);

    // 2. Load Encryption Key
    // Check if .env exists in parent directory to help local usage
    require('dotenv').config({ path: path.join(__dirname, '../.env.prod') });
    require('dotenv').config({ path: path.join(__dirname, '../.env') });

    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
        console.error('❌ ERROR: BACKUP_ENCRYPTION_KEY is not defined in environment or .env file.');
        process.exit(1);
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ ERROR: Input file not found: ${inputPath}`);
        process.exit(1);
    }

    console.log(`📦 Starting decryption: ${path.basename(inputPath)}`);
    console.log(`🔑 Key detected (SHA256): ${crypto.createHash('sha256').update(encryptionKey).digest('hex').substring(0, 8)}...`);

    try {
        const fileBuffer = fs.readFileSync(inputPath);
        const fileSize = fileBuffer.length;

        // HIPAA-compliant format: [IV (12b)] [Ciphertext (Variable)] [Auth Tag (16b)]
        const iv = fileBuffer.slice(0, 12);
        const authTag = fileBuffer.slice(fileSize - 16);
        const encryptedData = fileBuffer.slice(12, fileSize - 16);

        // Setup Decipher
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(encryptionKey.substring(0, 32)),
            iv
        );
        decipher.setAuthTag(authTag);

        // Setup Streams
        const readable = new (require('stream').Readable)();
        readable.push(encryptedData);
        readable.push(null);

        const writeStream = fs.createWriteStream(outputPath);

        console.log('🔓 Decrypting and decompressing...');

        await pipeline(
            readable,
            decipher,
            zlib.createGunzip(),
            writeStream
        );

        console.log(`✅ SUCCESS! Decrypted SQL saved to: ${outputPath}`);
        console.log(`📊 Final size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ DECRYPTION FAILED:', error.message);
        if (error.message.includes('Unsupported state or unable to authenticate data')) {
            console.error('👉 TIP: This usually means the encryption key is incorrect or the file is corrupted.');
        }
        process.exit(1);
    }
}

decryptArchive();
