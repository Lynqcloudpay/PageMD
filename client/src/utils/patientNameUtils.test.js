import { getPatientDisplayName, formatPatientName, looksEncrypted } from './patientNameUtils.js';
import assert from 'assert';

console.log('Running patientNameUtils tests...');

const longEncrypted = 'A'.repeat(50) + '='; // >30 chars, base64 chars only
const shortPlain = 'John';

// 1. looksEncrypted
assert.strictEqual(looksEncrypted('John'), false, 'Plain name should not be encrypted');
assert.strictEqual(looksEncrypted('John Doe'), false, 'Name with space not encrypted');
assert.strictEqual(looksEncrypted(longEncrypted), true, 'Long Base64 string should look encrypted');

// 2. formatPatientName
assert.strictEqual(formatPatientName('John', 'Doe'), 'John Doe');
assert.strictEqual(formatPatientName('John', ''), 'John');
assert.strictEqual(formatPatientName(longEncrypted, 'Doe'), 'Patient Name Loading...');

// 3. getPatientDisplayName
const p1 = { first_name: 'John', last_name: 'Doe' };
assert.strictEqual(getPatientDisplayName(p1), 'John Doe');

const p2 = { display_name: 'Jane Smith' };
assert.strictEqual(getPatientDisplayName(p2), 'Jane Smith');

const p3 = { first_name: longEncrypted, last_name: 'Doe' };
assert.strictEqual(getPatientDisplayName(p3), 'Patient Name Loading...');

const p4 = { display_name: longEncrypted };
assert.strictEqual(getPatientDisplayName(p4), 'Unknown Patient'); // Encryption rejected, no fallback names

const p5 = { patient_first_name: 'Alice', patient_last_name: 'Wonder' };
assert.strictEqual(getPatientDisplayName(p5), 'Alice Wonder');

console.log('All tests passed!');
