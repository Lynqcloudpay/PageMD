/**
 * Adversarial RBAC Test Suite
 * 
 * Tests RBAC enforcement by attempting unauthorized access with different roles
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-hipaa-verification-only';

// Test roles and their expected permissions
const ROLES = {
  'SuperAdmin': { role_id: 1, privileges: ['*'] },
  'Admin': { role_id: 2, privileges: ['*'] },
  'Physician': { role_id: 3, privileges: ['patient:view', 'patient:edit', 'visit:view', 'visit:create'] },
  'Nurse': { role_id: 4, privileges: ['patient:view', 'visit:view'] },
  'MedicalAssistant': { role_id: 5, privileges: ['patient:view'] },
  'Billing': { role_id: 6, privileges: ['patient:view', 'billing:read'] },
  'ReadOnly': { role_id: 7, privileges: ['patient:view', 'visit:view'] }
};

// Endpoints to test
const ENDPOINTS = [
  { path: '/api/patients', method: 'GET', requiredPrivilege: 'patient:view' },
  { path: '/api/patients', method: 'POST', requiredPrivilege: 'patient:create' },
  { path: '/api/patients/:id', method: 'GET', requiredPrivilege: 'patient:view' },
  { path: '/api/patients/:id', method: 'PUT', requiredPrivilege: 'patient:edit' },
  { path: '/api/visits', method: 'GET', requiredPrivilege: 'visit:view' },
  { path: '/api/visits', method: 'POST', requiredPrivilege: 'visit:create' },
  { path: '/api/documents/patient/:patientId', method: 'GET', requiredPrivilege: 'document:view' },
];

function createToken(userId, roleId) {
  return jwt.sign({ userId, roleId }, JWT_SECRET, { expiresIn: '1h' });
}

async function testEndpoint(role, endpoint, testPatientId = 'test-patient-id') {
  const token = createToken(`user-${role}`, ROLES[role]?.role_id || 1);
  const url = endpoint.path.replace(':id', testPatientId).replace(':patientId', testPatientId);
  const fullUrl = `${BASE_URL}${url}`;
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: fullUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: endpoint.method === 'POST' || endpoint.method === 'PUT' ? { test: 'data' } : undefined,
      validateStatus: () => true // Don't throw on any status
    });
    
    return {
      role,
      endpoint: endpoint.path,
      method: endpoint.method,
      requiredPrivilege: endpoint.requiredPrivilege,
      expected: ROLES[role]?.privileges.includes('*') || ROLES[role]?.privileges.includes(endpoint.requiredPrivilege) ? '200/201' : '403',
      actualStatus: response.status,
      pass: (ROLES[role]?.privileges.includes('*') || ROLES[role]?.privileges.includes(endpoint.requiredPrivilege)) 
        ? response.status >= 200 && response.status < 300
        : response.status === 403 || response.status === 401,
      responseSnippet: JSON.stringify(response.data).substring(0, 200)
    };
  } catch (error) {
    return {
      role,
      endpoint: endpoint.path,
      method: endpoint.method,
      requiredPrivilege: endpoint.requiredPrivilege,
      expected: ROLES[role]?.privileges.includes('*') || ROLES[role]?.privileges.includes(endpoint.requiredPrivilege) ? '200/201' : '403',
      actualStatus: error.response?.status || 'ERROR',
      pass: false,
      responseSnippet: error.message.substring(0, 200)
    };
  }
}

async function runAdversarialTests() {
  console.log('Running adversarial RBAC tests...\n');
  
  const results = [];
  const testPatientId = '00000000-0000-0000-0000-000000000001';
  
  for (const role of Object.keys(ROLES)) {
    for (const endpoint of ENDPOINTS) {
      const result = await testEndpoint(role, endpoint, testPatientId);
      results.push(result);
      console.log(`${result.pass ? '✅' : '❌'} ${role} ${endpoint.method} ${endpoint.path} -> ${result.actualStatus} (expected: ${result.expected})`);
    }
  }
  
  // Generate CSV
  const csv = [
    'role,endpoint,method,requiredPrivilege,expected,actualStatus,pass,responseSnippet'
  ];
  
  results.forEach(r => {
    csv.push([
      r.role,
      r.endpoint,
      r.method,
      r.requiredPrivilege,
      r.expected,
      r.actualStatus,
      r.pass,
      `"${r.responseSnippet.replace(/"/g, '""')}"`
    ].join(','));
  });
  
  return { results, csv: csv.join('\n') };
}

if (require.main === module) {
  runAdversarialTests()
    .then(({ results, csv }) => {
      const fs = require('fs');
      const path = require('path');
      const outputPath = path.join(__dirname, 'rbac-matrix-results.csv');
      fs.writeFileSync(outputPath, csv);
      
      const failures = results.filter(r => !r.pass);
      console.log(`\n✅ Tests completed: ${results.length} total, ${failures.length} failures\n`);
      
      if (failures.length > 0) {
        console.log('Failures:');
        failures.forEach(f => {
          console.log(`  ❌ ${f.role} ${f.method} ${f.endpoint} -> ${f.actualStatus} (expected ${f.expected})`);
        });
        process.exit(1);
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { runAdversarialTests };





















