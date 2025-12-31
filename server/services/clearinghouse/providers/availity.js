const axios = require('axios');
const qs = require('qs');

class AvailityProvider {
    constructor(config) {
        this.config = config; // { clientId, clientSecret, mode: 'sandbox' | 'prod' }
        this.baseUrl = config.mode === 'prod'
            ? 'https://api.availity.com'
            : 'https://api.availity.com'; // Availity uses same base, different credentials usually, or specific sandbox endpoints. 
        // Actually Availity often uses 'https://api.availity.com' for both but requires different apps.
        this.token = null;
        this.tokenExpiresAt = 0;
    }

    async authenticate() {
        if (this.token && Date.now() < this.tokenExpiresAt) {
            return this.token;
        }

        try {
            const response = await axios.post(
                'https://api.availity.com/mobile/token', // Common oauth endpoint or /availity/v1/token
                qs.stringify({
                    grant_type: 'client_credentials',
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    scope: 'hipaa'
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            this.token = response.data.access_token;
            // Set expiry (buffer 60s)
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;
            return this.token;
        } catch (error) {
            console.error('Availity Auth Failed:', error.response?.data || error.message);
            throw new Error('Clearinghouse authentication failed');
        }
    }

    /**
     * Map X12/Standard format to Availity JSON 270
     */
    async verifyEligibility270(params) {
        // params: { patientId, payerId, memberId, groupNumber, dob, ... }
        const token = await this.authenticate();

        try {
            // This is a simplified example of the Availity v3 Eligibility API request
            const requestBody = {
                payerId: params.payerId,
                providerNpi: params.npi,
                subscriber: {
                    memberId: params.memberId,
                    dateOfBirth: params.dob, // YYYY-MM-DD
                },
                serviceType: params.serviceTypeCode || '30' // 30 = Health Benefit Plan Coverage
            };

            const response = await axios.post(
                `${this.baseUrl}/coverages/v1/coverages`,
                requestBody,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Availity-Customer-ID': '1234' // Should be from config
                    }
                }
            );

            return this.parse271(response.data);

        } catch (error) {
            // Handle specific Availity errors
            if (error.response?.status === 400) {
                // Validation error
                throw new Error(`Validation Error: ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Eligibility check failed: ${error.message}`);
        }
    }

    /**
     * Parse Availity Response to normalized format
     */
    parse271(data) {
        // Normalize the provider-specific JSON response into our standard object
        // This is highly dependent on Availity's exact response structure
        const plans = data.plans || [];
        const primary = plans[0] || {};

        return {
            status: primary.status || 'Active', // Active, Inactive, etc.
            payer: primary.payerName,
            planName: primary.planName,
            memberId: primary.memberId,
            coverage: {
                active: primary.status === 'Active',
                copay: this.extractBenefit(primary, 'Copayment'),
                coinsurance: this.extractBenefit(primary, 'Coinsurance'),
                deductible: this.extractBenefit(primary, 'Deductible'),
                outOfPocket: this.extractBenefit(primary, 'Out of Pocket')
            },
            raw: data // Store for audit/admin view
        };
    }

    extractBenefit(plan, type) {
        // Helper to find specific benefit values from the complex benefits array
        if (!plan.benefits) return 'N/A';
        const benefit = plan.benefits.find(b => b.type === type);
        return benefit ? benefit.amount : 'N/A';
    }

    // Placeholder for Claim Submission
    async submitClaim837P(x12Content) {
        const token = await this.authenticate();
        // POST to /claims/v1/submit
        // ...
        return { id: 'mock-submission-id', status: 'RECEIVED' };
    }
}

module.exports = AvailityProvider;
