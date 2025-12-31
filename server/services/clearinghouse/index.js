const AvailityProvider = require('./providers/availity');
const pool = require('../../db');

// Supported providers
const PROVIDERS = {
    'availity': AvailityProvider
};

class ClearinghouseFactory {

    /**
     * Get configured provider for the current context (tenant)
     */
    async getProvider(tenantId) {
        // 1. Fetch config from DB
        // We assume a table 'clearinghouse_config' exists.
        // If not, we fall back to ENV variables (Single Tenant Mode)

        let config = null;

        try {
            const res = await pool.query(`
                SELECT provider, client_id, client_secret, mode 
                FROM clearinghouse_config 
                WHERE tenant_id = $1
            `, [tenantId || 'default']);

            if (res.rows.length > 0) {
                config = res.rows[0];
            }
        } catch (e) {
            // Table might not exist yet
            // console.warn("Clearinghouse config table not found, using ENV");
        }

        // Fallback to Env
        if (!config) {
            config = {
                provider: process.env.CLEARINGHOUSE_PROVIDER || 'availity',
                clientId: process.env.AVAILITY_CLIENT_ID || 'mock-client-id',
                clientSecret: process.env.AVAILITY_CLIENT_SECRET || 'mock-secret',
                mode: process.env.CLEARINGHOUSE_MODE || 'sandbox'
            };
        }

        const ProviderClass = PROVIDERS[config.provider];
        if (!ProviderClass) {
            throw new Error(`Unsupported clearinghouse provider: ${config.provider}`);
        }

        return new ProviderClass({
            clientId: config.client_id || config.clientId,
            clientSecret: config.client_secret || config.clientSecret,
            mode: config.mode
        });
    }

    /**
     * Verify Eligibility (Public Facade) with retry logic
     */
    async verifyEligibility(params) {
        const provider = await this.getProvider(params.tenantId);

        const maxRetries = 3;
        const baseDelayMs = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await provider.verifyEligibility270(params);
            } catch (e) {
                const isRetryable = this.isRetryableError(e);

                if (!isRetryable || attempt === maxRetries) {
                    // PRODUCTION HARD BLOCK: Never return demo data in prod mode
                    const isProdMode = process.env.CLEARINGHOUSE_MODE === 'prod' ||
                        process.env.NODE_ENV === 'production';

                    if (isProdMode) {
                        // In production, throw actionable, PHI-safe error
                        console.error('Clearinghouse eligibility failed in PROD mode:', e.message);
                        throw new Error('Eligibility verification unavailable. Please contact support. (Code: ELIG_FAIL)');
                    }

                    // SANDBOX/DEV ONLY: Return demo data for testing UI flow
                    const isAuthError = e.message.includes('auth') ||
                        e.message.includes('401') ||
                        e.message.includes('credentials') ||
                        e.message.includes('ENOTFOUND');

                    if (isAuthError) {
                        console.warn('[SANDBOX] Auth failed, returning demo eligibility data for UI testing...');
                        return {
                            status: 'Active',
                            payer: 'Sandbox Demo',
                            planName: 'Gold Plan PPO (Demo)',
                            memberId: params.memberId,
                            coverage: {
                                active: true,
                                copay: '25.00',
                                deductible: '1000.00',
                                deductibleRemaining: '750.00',
                                coinsurance: '20%',
                                outOfPocketMax: '6000.00'
                            },
                            timestamp: new Date().toISOString(),
                            isDemo: true,
                            warning: 'This is demo data. Configure clearinghouse credentials for real eligibility.'
                        };
                    }
                    throw e;
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                console.warn(`Eligibility attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }
    }

    /**
     * Check if error is retryable (transient)
     * DO NOT retry: 400 (bad request), 401 (auth), 403 (forbidden)
     */
    isRetryableError(e) {
        const status = e.response?.status;

        // Explicitly DO NOT retry client errors
        const nonRetryableCodes = [400, 401, 403, 404, 422];
        if (status && nonRetryableCodes.includes(status)) return false;

        // Retry on timeouts, rate limits, and server errors
        const retryableCodes = [408, 429, 500, 502, 503, 504];
        if (status && retryableCodes.includes(status)) return true;

        // Network errors - retry
        if (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED') return true;
        if (e.message?.includes('timeout')) return true;

        return false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new ClearinghouseFactory();
