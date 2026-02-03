/**
 * Rate Limiting Middleware (Per-App)
 * 
 * Implements rate limiting based on app's rate limit policy.
 * Works with OAuth authenticated requests.
 */

const pool = require('../db');

// In-memory rate limit tracking (for production, use Redis)
const rateLimitStore = new Map();

// Cleanup interval for expired entries
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (data.windowStart + 60000 < now) { // Clean up entries older than 1 minute
            rateLimitStore.delete(key);
        }
    }
}, 60000);

/**
 * Get or create rate limit entry for an app+tenant
 */
function getOrCreateEntry(key, windowMs = 60000) {
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry || entry.windowStart + windowMs < now) {
        entry = {
            windowStart: now,
            count: 0,
            burstCount: 0,
            hourlyWindowStart: Math.floor(now / 3600000) * 3600000,
            hourlyCount: 0,
            dailyWindowStart: Math.floor(now / 86400000) * 86400000,
            dailyCount: 0
        };
        rateLimitStore.set(key, entry);
    }

    // Reset hourly counter if needed
    const currentHour = Math.floor(now / 3600000) * 3600000;
    if (entry.hourlyWindowStart < currentHour) {
        entry.hourlyWindowStart = currentHour;
        entry.hourlyCount = 0;
    }

    // Reset daily counter if needed
    const currentDay = Math.floor(now / 86400000) * 86400000;
    if (entry.dailyWindowStart < currentDay) {
        entry.dailyWindowStart = currentDay;
        entry.dailyCount = 0;
    }

    return entry;
}

/**
 * Rate limit middleware for OAuth-authenticated requests
 */
const rateLimitByApp = async (req, res, next) => {
    // Skip if no OAuth context
    if (!req.oauth) {
        return next();
    }

    const { appId, tenantId, rateLimit } = req.oauth;

    if (!rateLimit || !rateLimit.sustainedPerMin) {
        // No rate limit configured, allow through
        return next();
    }

    const key = `${appId}:${tenantId}`;
    const entry = getOrCreateEntry(key);

    // Increment counters
    entry.count++;
    entry.burstCount++;
    entry.hourlyCount++;
    entry.dailyCount++;

    // Check burst limit (short window, typically 1 second)
    // For burst, we use a sliding window approximation
    const burstWindow = 1000; // 1 second
    const now = Date.now();
    if (now - entry.windowStart < burstWindow && entry.burstCount > rateLimit.burst) {
        return sendRateLimitResponse(res, 'burst', rateLimit.burst, 1);
    }

    // Reset burst counter every second
    if (now - entry.windowStart >= burstWindow) {
        entry.burstCount = 1;
    }

    // Check sustained per-minute limit
    if (entry.count > rateLimit.sustainedPerMin) {
        const retryAfter = Math.ceil((entry.windowStart + 60000 - now) / 1000);
        return sendRateLimitResponse(res, 'minute', rateLimit.sustainedPerMin, retryAfter);
    }

    // Check hourly limit
    if (rateLimit.perHour && entry.hourlyCount > rateLimit.perHour) {
        const retryAfter = Math.ceil((entry.hourlyWindowStart + 3600000 - now) / 1000);
        return sendRateLimitResponse(res, 'hour', rateLimit.perHour, retryAfter);
    }

    // Check daily limit
    if (rateLimit.perDay && entry.dailyCount > rateLimit.perDay) {
        const retryAfter = Math.ceil((entry.dailyWindowStart + 86400000 - now) / 1000);
        return sendRateLimitResponse(res, 'day', rateLimit.perDay, retryAfter);
    }

    // Set rate limit headers
    const remaining = Math.max(0, rateLimit.sustainedPerMin - entry.count);
    const resetTime = Math.ceil((entry.windowStart + 60000) / 1000);

    res.set('X-RateLimit-Limit', rateLimit.sustainedPerMin);
    res.set('X-RateLimit-Remaining', remaining);
    res.set('X-RateLimit-Reset', resetTime);

    next();
};

/**
 * Send 429 rate limit response
 */
function sendRateLimitResponse(res, window, limit, retryAfter) {
    res.set('Retry-After', retryAfter);
    res.set('X-RateLimit-Limit', limit);
    res.set('X-RateLimit-Remaining', 0);
    res.set('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + retryAfter);

    return res.status(429).json({
        error: {
            code: 'rate_limit_exceeded',
            message: `Rate limit exceeded. Limit: ${limit} per ${window}. Retry after ${retryAfter} seconds.`,
            retry_after: retryAfter,
            limit_type: window,
            request_id: res.requestId
        }
    });
}

/**
 * Get current rate limit stats for an app
 */
function getRateLimitStats(appId, tenantId) {
    const key = `${appId}:${tenantId}`;
    return rateLimitStore.get(key) || null;
}

module.exports = {
    rateLimitByApp,
    getRateLimitStats
};
