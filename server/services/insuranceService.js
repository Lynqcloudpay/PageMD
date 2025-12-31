const pool = require('../db');

class InsuranceService {
    async verify(patientId) {
        try {
            // Mock Logic: Fetch insurance
            // We interpret 'insurance_data' table (OpenEMR standard compatibility)
            // If table doesn't exist, we fallback to a mock response based on Patient ID for demo.

            // Check if table exists (cache this in real app)
            // For now, simpler: Try to query.
            const res = await pool.query(`
                SELECT * FROM insurance_data 
                WHERE pid = $1 
                ORDER BY date DESC LIMIT 1
            `, [patientId]);

            if (res.rows.length === 0) {
                // Fallback Mock for Demo if no insurance record
                return {
                    status: 'Unknown',
                    message: 'No insurance on file',
                    details: { payer: 'N/A' }
                };
            }

            const ins = res.rows[0];
            const policy = ins.policy_number || '';
            const isVerified = policy.toUpperCase().startsWith('A');

            return {
                status: isVerified ? 'Verified' : 'Rejected',
                message: isVerified ? 'Active Coverage (Mock)' : 'Policy Rejected (Mock)',
                details: {
                    payer: ins.provider || 'Unknown Payer',
                    policy: policy,
                    date: new Date()
                }
            };
        } catch (e) {
            if (e.code === '42P01') { // undefined table
                // Mock behavior if table invalid
                const isVerified = (Math.random() > 0.3);
                return {
                    status: isVerified ? 'Verified' : 'Rejected',
                    message: 'Mock Verification (No DB Table)',
                    details: { payer: 'Mock Payer', policy: '12345' }
                };
            }
            throw e;
        }
    }
}

module.exports = new InsuranceService();
