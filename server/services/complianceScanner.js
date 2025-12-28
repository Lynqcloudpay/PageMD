/**
 * Compliance Scanner Service
 * Automated checks for Data Residency, Encryption Config, and Security Posture.
 */
const pool = require('../db');

class ComplianceScanner {

    /**
     * Run all compliance checks
     */
    static async scan() {
        const results = {
            timestamp: new Date(),
            passed: true,
            checks: []
        };

        // 1. Environment Security Check
        const envCheck = this.checkEnvironment();
        results.checks.push(envCheck);
        if (!envCheck.passed) results.passed = false;

        // 2. Data Residency Check
        const residencyCheck = await this.checkDataResidency();
        results.checks.push(residencyCheck);
        if (!residencyCheck.passed) results.passed = false;

        return results;
    }

    /**
     * Verify Environment Variables for Security
     */
    static checkEnvironment() {
        const issues = [];
        const isProd = process.env.NODE_ENV === 'production';

        if (isProd) {
            if (process.env.ENABLE_PHI_ENCRYPTION !== 'true') {
                issues.push('Production: ENABLE_PHI_ENCRYPTION is not "true".');
            }
            if (!process.env.BACKUP_ENCRYPTION_KEY) {
                issues.push('Production: BACKUP_ENCRYPTION_KEY is missing.');
            }
            if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
                issues.push('Production: JWT_SECRET is weak or missing (min 32 chars).');
            }
        } else {
            // Dev checks
            if (!process.env.JWT_SECRET) issues.push('JWT_SECRET is missing.');
        }

        return {
            name: 'Environment Security',
            passed: issues.length === 0,
            details: issues.length > 0 ? issues : ['Environment variables configured correctly.']
        };
    }

    /**
     * Verify Data Residency (Compliance Zones vs Region)
     */
    static async checkDataResidency() {
        const issues = [];
        let clinicCount = 0;

        try {
            const res = await pool.controlPool.query('SELECT id, display_name, slug, compliance_zones, region FROM clinics WHERE status = $1', ['active']);
            clinicCount = res.rowCount;

            for (const clinic of res.rows) {
                const zones = clinic.compliance_zones || [];
                const region = (clinic.region || '').toLowerCase();

                // Rules
                if (zones.includes('GDPR')) {
                    const isEU = ['eu-west', 'eu-central', 'uk-south', 'uk-west'].some(r => region.includes(r));
                    if (!isEU) {
                        issues.push(`Clinic ${clinic.slug} requires GDPR but lies in region '${region}'.`);
                    }
                }

                if (zones.includes('HIPAA')) {
                    // HIPAA usually implies US hosting preferences, though not strictly required by law to be US-only if BAA exists.
                    // However, we enforce US residency for "HIPAA" tagged items for this platform.
                    const isUS = ['us-east', 'us-west', 'us-central', 'us', 'usa'].some(r => region.includes(r));
                    if (!isUS) {
                        issues.push(`Clinic ${clinic.slug} flagged for HIPAA but lies in region '${region}'.`);
                    }
                }
            }
        } catch (err) {
            return {
                name: 'Data Residency',
                passed: false,
                details: [`DB Error: ${err.message}`]
            };
        }

        return {
            name: 'Data Residency',
            passed: issues.length === 0,
            details: issues.length > 0 ? issues : [`Verified ${clinicCount} clinics.`]
        };
    }
}

module.exports = ComplianceScanner;
