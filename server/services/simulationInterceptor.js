/**
 * Simulation Interceptor
 * Intercepts external API calls and returns mock data if in Sandbox mode.
 */

const pool = require('../db');

const isSandboxMode = () => {
    try {
        const client = pool.dbStorage.getStore();
        // 🚨 CRITICAL FIX: Only treat as sandbox if it's an actual auto-provisioned demo schema
        // prefix 'sandbox_' is used for ephemeral demos. Standard tenants use 'tenant_'.
        const isSandbox = client && client.tenantSchema && client.tenantSchema.toLowerCase().startsWith('sandbox_');

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
