const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

/**
 * ArchivalService
 * Handles HIPAA-compliant clinical data archival. 
 * Creates encrypted, compressed backups of tenant schemas.
 */
class ArchivalService {
    constructor() {
        this.archiveDir = path.join(__dirname, '../archives');
        if (!fs.existsSync(this.archiveDir)) {
            fs.mkdirSync(this.archiveDir, { recursive: true });
        }

        // Use BACKUP_ENCRYPTION_KEY or fallback to ENCRYPTION_KEY if available.
        // For security, it should be a 32-byte key.
        this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Creates an encrypted, compressed dump of a specific schema.
     * @param {string} schemaName The tenant schema to dump
     * @param {string} clinicId For naming and logging
     * @returns {Promise<string>} Path to the resulting .enc file
     */
    async createClinicArchive(clinicId, schemaName) {
        if (!schemaName.startsWith('tenant_')) {
            throw new Error('Invalid schema name for archival');
        }

        if (!this.encryptionKey) {
            console.error('[Archival] ⚠️ NO ENCRYPTION KEY CONFIGURED. Backup aborted for safety.');
            throw new Error('Archival failed: BACKUP_ENCRYPTION_KEY not configured');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `archive_${schemaName}_${clinicId}_${timestamp}.sql.gz.enc`;
        const outputPath = path.join(this.archiveDir, filename);

        console.log(`[Archival] 📦 Starting archival for clinic ${clinicId} (Schema: ${schemaName})...`);

        try {
            // 1. Prepare pg_dump command using the environment's DATABASE_URL
            // We use the local pg_dump binary found inside the container.
            const dbUrl = process.env.DATABASE_URL;
            const pgDumpCmd = `pg_dump "${dbUrl}" -n ${schemaName}`;

            // 2. Encryption Setup
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey.substring(0, 32)), iv);

            // 3. Create Write Stream
            const writeStream = fs.createWriteStream(outputPath);

            // Store IV at the beginning of the file
            writeStream.write(iv);

            // 4. Execute dump and pipe through compression and encryption
            const { spawn } = require('child_process');
            const dumpProcess = spawn('sh', ['-c', pgDumpCmd]);

            // Track any errors from pg_dump
            let dumpError = '';
            dumpProcess.stderr.on('data', (data) => {
                dumpError += data.toString();
            });

            await pipeline(
                dumpProcess.stdout,
                zlib.createGzip(),
                cipher,
                writeStream
            );

            // Append auth tag to the end of the file for GCM
            const authTag = cipher.getAuthTag();
            fs.appendFileSync(outputPath, authTag);

            if (dumpError && !dumpError.includes('NOTICE')) {
                throw new Error(`pg_dump error: ${dumpError}`);
            }

            console.log(`[Archival] ✅ Archival successful: ${outputPath}`);

            // TODO: AWS S3 Upload implementation (Phase 2)
            if (process.env.AWS_S3_BACKUP_BUCKET) {
                console.log(`[Archival] ☁️ AWS S3 Upload triggered for ${filename}`);
                // this.uploadToS3(outputPath, filename);
            }

            return outputPath;
        } catch (error) {
            console.error(`[Archival] ❌ Archival failed for ${clinicId}:`, error.message);
            // Cleanup partial file
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            throw error;
        }
    }
    /**
     * Lists all available archives in the local directory.
     * @returns {Promise<Array>} List of archive files with metadata
     */
    async listArchives() {
        try {
            const files = await fs.promises.readdir(this.archiveDir);
            const archives = [];

            // Regex to parse: archive_tenant_[slug]_[uuid]_[timestamp].sql.gz.enc
            // Example: archive_tenant_test_002d3183-866a-4d08-887e-76d8d21cbe0f_2026-02-10T21-45-27-578Z.sql.gz.enc
            const archiveRegex = /archive_(tenant_[^_]+)_([a-f0-9-]+)_([\d-]+T[\d-]+Z)\.sql\.gz\.enc/;

            for (const file of files) {
                if (file.endsWith('.enc')) {
                    const filePath = path.join(this.archiveDir, file);
                    const stats = await fs.promises.stat(filePath);

                    const match = file.match(archiveRegex);
                    const schemaName = match ? match[1] : 'unknown';
                    const clinicId = match ? match[2] : 'unknown';
                    const archiveTimestamp = match ? match[3].replace(/-/g, ':') : stats.birthtime;

                    // Extract a readable slug (e.g. tenant_test -> test)
                    const clinicSlug = schemaName.startsWith('tenant_') ? schemaName.replace('tenant_', '') : schemaName;

                    archives.push({
                        filename: file,
                        size: stats.size,
                        created_at: stats.birthtime,
                        archive_timestamp: archiveTimestamp,
                        clinic_id: clinicId,
                        clinic_slug: clinicSlug,
                        schema_name: schemaName,
                        path: filePath
                    });
                }
            }

            // Sort by creation date descending
            return archives.sort((a, b) => b.created_at - a.created_at);
        } catch (error) {
            console.error('[Archival] Failed to list archives:', error);
            throw error;
        }
    }

    /**
     * Gets a read stream for a specific archive file.
     * @param {string} filename Name of the archive file
     * @returns {fs.ReadStream} Read stream of the file
     */
    getArchiveReadStream(filename) {
        // Security check: prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(this.archiveDir, safeFilename);

        if (!fs.existsSync(filePath)) {
            throw new Error('Archive not found');
        }

        return fs.createReadStream(filePath);
    }
}

module.exports = new ArchivalService();
