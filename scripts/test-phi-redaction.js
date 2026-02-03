/**
 * Verification Script: PHI Redaction
 * Feeds sensitive data to the redactor and ensures masking.
 */
const { redactPHI } = require('../server/middleware/phiRedaction');

const testCases = [
    {
        name: 'SSN Redaction',
        input: { ssn: '123-45-6789', note: 'Patient SSN is 123-45-6789' },
        expected: { ssn: '[REDACTED]', note: '[REDACTED]' }
    },
    {
        name: 'Medical ID Redaction',
        input: { npi: '1234567890', dea: 'AB1234567' },
        expected: { npi: '[REDACTED]', dea: '[REDACTED]' }
    },
    {
        name: 'Names & DOB',
        input: { firstName: 'John', lastName: 'Doe', dob: '1980-01-01' },
        expected: { firstName: '[REDACTED]', lastName: '[REDACTED]', dob: '[REDACTED]' }
    }
];

console.log('--- PHI Redaction Test ---');
let passed = 0;
testCases.forEach(tc => {
    const result = redactPHI(tc.input);
    const success = JSON.stringify(result) === JSON.stringify(tc.expected);
    if (success) passed++;
    console.log(`${success ? '✅' : '❌'} ${tc.name}`);
});

process.exit(passed === testCases.length ? 0 : 1);
