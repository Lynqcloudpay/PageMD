const { analyzePatientLabs } = require('./services/echoLabEngine');

// Mock lab orders
const mockOrders = [
    {
        id: '1',
        created_at: '2023-10-01T10:00:00Z',
        test_name: 'Hemoglobin A1c',
        result_value: '5.4',
        result_units: '%',
        order_type: 'lab'
    },
    {
        id: '2',
        created_at: '2023-12-01T10:00:00Z',
        test_name: 'HbA1c',
        result_value: '5.9',
        result_units: '%',
        order_type: 'lab'
    },
    {
        id: '3',
        created_at: '2024-02-01T10:00:00Z',
        test_name: 'A1c',
        result_value: '6.5',
        result_units: '%',
        order_type: 'lab'
    },
    {
        id: '4',
        created_at: '2024-02-01T10:00:00Z',
        test_name: 'Potassium',
        result_value: '7.2', // Critical high
        result_units: 'mEq/L',
        order_type: 'lab'
    }
];

// Test analysis
const analysis = analyzePatientLabs(mockOrders);

console.log('--- LAB ANALYSIS REPORT ---');
console.log(JSON.stringify(analysis, null, 2));

if (analysis.trends.length > 0 && analysis.criticals.length > 0) {
    console.log('\n✅ Test PASSED: Trends and criticals detected correctly.');
} else {
    console.log('\n❌ Test FAILED: Missing trends or criticals.');
}
