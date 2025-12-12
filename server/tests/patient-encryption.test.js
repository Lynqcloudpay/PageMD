/**
 * Patient Encryption Service Tests
 * 
 * Verifies encryption/decryption roundtrip for patient PHI fields
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.KMS_PROVIDER = 'local';
process.env.JWT_SECRET = 'test-secret-key-for-encryption';

const patientEncryptionService = require('../services/patientEncryptionService');
const encryptionService = require('../services/encryptionService');

describe('Patient Encryption Service', () => {
  describe('encryptPatientPHI', () => {
    test('should encrypt PHI fields', async () => {
      const patient = {
        id: '123',
        mrn: 'MRN001',
        first_name: 'John',
        last_name: 'Doe',
        dob: '1990-01-01',
        phone: '555-1234',
        email: 'john.doe@example.com',
        address_line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      };

      const encrypted = await patientEncryptionService.encryptPatientPHI(patient);

      // PHI fields should be encrypted (base64 strings)
      expect(encrypted.first_name).not.toBe('John');
      expect(encrypted.first_name).toBeDefined();
      expect(typeof encrypted.first_name).toBe('string');
      expect(encrypted.first_name.length).toBeGreaterThan(20); // Encrypted data is longer

      expect(encrypted.last_name).not.toBe('Doe');
      expect(encrypted.email).not.toBe('john.doe@example.com');
      expect(encrypted.phone).not.toBe('555-1234');

      // Non-PHI fields should remain unchanged
      expect(encrypted.id).toBe('123');
      expect(encrypted.mrn).toBe('MRN001');

      // Should have encryption metadata
      expect(encrypted.encryption_metadata).toBeDefined();
      expect(encrypted.encryption_metadata.first_name).toBeDefined();
      expect(encrypted.encryption_metadata.first_name.keyId).toBeDefined();
    });

    test('should handle null and undefined values', async () => {
      const patient = {
        mrn: 'MRN001',
        first_name: 'John',
        last_name: null,
        email: undefined,
        phone: ''
      };

      const encrypted = await patientEncryptionService.encryptPatientPHI(patient);

      expect(encrypted.first_name).toBeDefined();
      expect(encrypted.last_name).toBeNull();
      expect(encrypted.email).toBeUndefined();
    });
  });

  describe('decryptPatientPHI', () => {
    test('should decrypt PHI fields', async () => {
      // First encrypt
      const patient = {
        mrn: 'MRN001',
        first_name: 'John',
        last_name: 'Doe',
        dob: '1990-01-01',
        phone: '555-1234',
        email: 'john.doe@example.com'
      };

      const encrypted = await patientEncryptionService.encryptPatientPHI(patient);
      
      // Then decrypt
      const decrypted = await patientEncryptionService.decryptPatientPHI(encrypted);

      // PHI fields should be decrypted
      expect(decrypted.first_name).toBe('John');
      expect(decrypted.last_name).toBe('Doe');
      expect(decrypted.dob).toBe('1990-01-01');
      expect(decrypted.phone).toBe('555-1234');
      expect(decrypted.email).toBe('john.doe@example.com');

      // Encryption metadata should be removed from response
      expect(decrypted.encryption_metadata).toBeUndefined();
    });

    test('should handle roundtrip encryption/decryption', async () => {
      const original = {
        mrn: 'MRN001',
        first_name: 'Jane',
        last_name: 'Smith',
        dob: '1985-05-15',
        phone: '555-9876',
        email: 'jane.smith@example.com',
        address_line1: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      };

      const encrypted = await patientEncryptionService.encryptPatientPHI(original);
      const decrypted = await patientEncryptionService.decryptPatientPHI(encrypted);

      expect(decrypted.first_name).toBe(original.first_name);
      expect(decrypted.last_name).toBe(original.last_name);
      expect(decrypted.dob).toBe(original.dob);
      expect(decrypted.phone).toBe(original.phone);
      expect(decrypted.email).toBe(original.email);
      expect(decrypted.address_line1).toBe(original.address_line1);
      expect(decrypted.city).toBe(original.city);
      expect(decrypted.state).toBe(original.state);
      expect(decrypted.zip).toBe(original.zip);
    });
  });

  describe('decryptPatientsPHI', () => {
    test('should decrypt multiple patients', async () => {
      const patients = [
        { mrn: 'MRN001', first_name: 'John', last_name: 'Doe' },
        { mrn: 'MRN002', first_name: 'Jane', last_name: 'Smith' }
      ];

      // Encrypt all
      const encrypted = await Promise.all(
        patients.map(p => patientEncryptionService.encryptPatientPHI(p))
      );

      // Decrypt all
      const decrypted = await patientEncryptionService.decryptPatientsPHI(encrypted);

      expect(decrypted.length).toBe(2);
      expect(decrypted[0].first_name).toBe('John');
      expect(decrypted[1].first_name).toBe('Jane');
    });
  });

  describe('isPHIField', () => {
    test('should identify PHI fields correctly', () => {
      expect(patientEncryptionService.isPHIField('first_name')).toBe(true);
      expect(patientEncryptionService.isPHIField('last_name')).toBe(true);
      expect(patientEncryptionService.isPHIField('dob')).toBe(true);
      expect(patientEncryptionService.isPHIField('phone')).toBe(true);
      expect(patientEncryptionService.isPHIField('email')).toBe(true);
      expect(patientEncryptionService.isPHIField('address_line1')).toBe(true);
      expect(patientEncryptionService.isPHIField('ssn')).toBe(true);

      expect(patientEncryptionService.isPHIField('mrn')).toBe(false);
      expect(patientEncryptionService.isPHIField('id')).toBe(false);
      expect(patientEncryptionService.isPHIField('created_at')).toBe(false);
    });
  });
});

