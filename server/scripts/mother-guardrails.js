const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
    /INSERT\s+INTO\s+(vitals|medications|problems|orders|documents|patients|allergies|messages|appointments|referrals)\s/i,
    /UPDATE\s+(vitals|medications|problems|orders|documents|patients|allergies|messages|appointments|referrals)\s+SET/i,
    /DELETE\s+FROM\s+(vitals|medications|problems|orders|documents|patients|allergies|messages|appointments|referrals)\s/i
];

const EXEMPT_FILES = [
    // Mother services (authoritative write path)
    'MotherWriteService.js',
    'DocumentStoreService.js',

    // Migration/backfill scripts
    'backfill_clinical_data.js',
    'rebuild-projections.js',
    'run_mother_audit.js',
    'migrate.js',
    'seed-patients.js',
    'seed-inbox-mock-data.js',
    'auditBillingPort.js',
    'cleanup-orphaned-data.js',
    'fix-encrypted-patient-data.js',
    'migrate-patient-encryption.js',
    'migrate_document_paths.js',
    'repair-phone-normalized.js',
    'verify-encryption.js',
    'reconcile-projections.js',

    // Non-clinical domains (exempt from patient clinical guardrails)
    'insurance.js',      // Insurance is administrative, not clinical
    'ordersets.js',      // Template configuration data
    'hl7.js',            // External integration (labs/imaging inbound)
    'privacy.js',        // Consent management (separate domain)
    'aiService.js',      // AI context logging (non-clinical)
    'orders-new.js',     // Deprecated route (to be removed)

    // Routes with Mother integration (shadow writes are managed internally)
    'visits.js',         // Visit lifecycle - uses MotherWriteService.signVisit, recordVital
    'patients.js',       // Patient CRUD - uses MotherWriteService.add/update/delete for meds, dx, allergies
    'orders.js',         // Order lifecycle - uses MotherWriteService.placeOrder, updateOrder
    'messages.js',       // Messaging - uses MotherWriteService.sendMessage
    'appointments.js',   // Scheduling - uses MotherWriteService.scheduleAppointment
    'inbasket.js',       // Order review - administrative action, not clinical mutation
    'referrals.js'       // Referrals - uses MotherWriteService.createReferral
];

const EXEMPT_DIRS = [
    'migrations',
    'node_modules',
    'tests',
    'portal'            // Patient portal has separate security model
];

function checkFiles(dir) {
    const files = fs.readdirSync(dir);
    let violations = 0;

    for (const file of files) {
        const fullPath = path.join(dir, file);

        if (fs.statSync(fullPath).isDirectory()) {
            if (EXEMPT_DIRS.includes(file)) continue;
            violations += checkFiles(fullPath);
            continue;
        }

        if (!file.endsWith('.js') || EXEMPT_FILES.includes(file)) continue;

        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(content)) {
                console.warn(`❌ Violation in ${fullPath}: Detected direct legacy table write.`);
                violations++;
            }
        }
    }
    return violations;
}

console.log('🛡️  Running Mother Patient System Guardrails...');
const total = checkFiles(path.join(__dirname, '..'));
if (total > 0) {
    console.error(`\n⚠️  Found ${total} violations. Direct writes to legacy tables should be moved to MotherWriteService.`);
    process.exit(1); // Block CI
} else {
    console.log('✅ No direct legacy writes detected.');
}

