/**
 * Simulation Interceptor
 * Intercepts external API calls and returns mock data if in Sandbox mode.
 */

const pool = require('../db');

const isSandboxMode = () => {
    const client = pool.dbStorage.getStore();
    // In our implementation, sandbox accounts are routed to schema 'sandbox_...'
    return client && client.tenantSchema && client.tenantSchema.startsWith('sandbox_');
};

const simulate = (serviceName, operation, mockResponse) => {
    if (isSandboxMode()) {
        console.log(`[Simulation] Intercepted ${serviceName}.${operation}. Returning mock response.`);
        return typeof mockResponse === 'function' ? mockResponse() : mockResponse;
    }
    return null;
};

module.exports = {
    isSandboxMode,
    simulate
};
