/**
 * Simulation Interceptor
 * Intercepts external API calls and returns mock data if in Sandbox mode.
 */

const pool = require('../db');

const isSandboxMode = () => {
    try {
        const client = pool.dbStorage.getStore();
        // In our implementation, sandbox accounts are routed to schema 'sandbox_...'
        const isSandbox = client && client.tenantSchema && client.tenantSchema.startsWith('sandbox_');

        // Debug log if we are in sandbox
        if (isSandbox) {
            // Only log once in a while or per-operation in simulate()
        }

        return !!isSandbox;
    } catch (e) {
        return false;
    }
};

const simulate = (serviceName, operation, mockResponse) => {
    if (isSandboxMode()) {
        console.log(`[Simulation] 🛡️ SANDBOX ISOLATION ACTIVE: Intercepted ${serviceName}.${operation}`);
        return typeof mockResponse === 'function' ? mockResponse() : mockResponse;
    }
    return null;
};

module.exports = {
    isSandboxMode,
    simulate
};
