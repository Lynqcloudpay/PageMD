/**
 * Webhook Delivery Worker
 * 
 * Background worker that:
 * 1. Polls outbox_events for unpublished events
 * 2. Finds matching webhook subscriptions
 * 3. Delivers webhooks with HMAC signatures
 * 4. Implements retry with exponential backoff
 */

const crypto = require('crypto');
const pool = require('../db');

// Retry schedule: 1m, 5m, 15m, 1h, 6h, 24h
const RETRY_DELAYS_MS = [
    60 * 1000,        // 1 minute
    5 * 60 * 1000,    // 5 minutes
    15 * 60 * 1000,   // 15 minutes
    60 * 60 * 1000,   // 1 hour
    6 * 60 * 60 * 1000,  // 6 hours
    24 * 60 * 60 * 1000  // 24 hours
];

const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const signaturePayload = `${timestamp}.${payloadString}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');
    return { signature, timestamp };
}

/**
 * Deliver a single webhook
 */
async function deliverWebhook(subscription, event, deliveryId) {
    const payload = {
        id: event.id,
        type: event.type,
        created_at: event.created_at,
        data: event.payload
    };

    const { signature, timestamp } = generateSignature(payload, subscription.secret);

    const headers = {
        'Content-Type': 'application/json',
        'X-PageMD-Signature': `t=${timestamp},v1=${signature}`,
        'X-PageMD-Event-Id': event.id,
        'X-PageMD-Event-Type': event.type,
        'X-PageMD-Delivery-Id': deliveryId
    };

    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(subscription.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;
        const responseBody = await response.text().catch(() => '');

        return {
            success: response.ok,
            statusCode: response.status,
            responseBody: responseBody.substring(0, 1000), // Limit stored response
            durationMs
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        return {
            success: false,
            statusCode: null,
            error: error.name === 'AbortError' ? 'Request timeout' : error.message,
            durationMs
        };
    }
}

/**
 * Process pending outbox events
 */
async function processOutboxEvents() {
    try {
        // Get unpublished events
        const eventsResult = await pool.controlPool.query(
            `SELECT * FROM outbox_events 
       WHERE published_at IS NULL AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
            [BATCH_SIZE]
        );

        if (eventsResult.rows.length === 0) {
            return 0;
        }

        let processed = 0;

        for (const event of eventsResult.rows) {
            // Find matching subscriptions
            const subsResult = await pool.controlPool.query(
                `SELECT * FROM webhook_subscriptions
         WHERE tenant_id = $1 AND status = 'active' AND $2 = ANY(events)`,
                [event.tenant_id, event.type]
            );

            if (subsResult.rows.length === 0) {
                // No subscriptions, mark as published
                await pool.controlPool.query(
                    `UPDATE outbox_events SET published_at = NOW(), status = 'published' WHERE id = $1`,
                    [event.id]
                );
                processed++;
                continue;
            }

            // Create delivery records for each subscription
            for (const subscription of subsResult.rows) {
                // Check if delivery already exists
                const existingDelivery = await pool.controlPool.query(
                    `SELECT id FROM webhook_deliveries 
           WHERE subscription_id = $1 AND event_id = $2`,
                    [subscription.id, event.id]
                );

                if (existingDelivery.rows.length === 0) {
                    await pool.controlPool.query(
                        `INSERT INTO webhook_deliveries (subscription_id, event_id, status)
             VALUES ($1, $2, 'pending')`,
                        [subscription.id, event.id]
                    );
                }
            }

            // Mark event as published (deliveries will be processed separately)
            await pool.controlPool.query(
                `UPDATE outbox_events SET published_at = NOW(), status = 'published' WHERE id = $1`,
                [event.id]
            );
            processed++;
        }

        return processed;
    } catch (error) {
        console.error('[WebhookWorker] Error processing outbox events:', error);
        return 0;
    }
}

/**
 * Process pending webhook deliveries
 */
async function processDeliveries() {
    try {
        // Get pending deliveries ready for retry
        const deliveriesResult = await pool.controlPool.query(
            `SELECT wd.*, ws.url, ws.secret, ws.status as sub_status,
              oe.type, oe.payload, oe.created_at as event_created_at, oe.tenant_id
       FROM webhook_deliveries wd
       JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
       JOIN outbox_events oe ON wd.event_id = oe.id
       WHERE wd.status = 'pending' 
         AND (wd.next_retry_at IS NULL OR wd.next_retry_at <= NOW())
         AND wd.attempt <= $1
         AND ws.status = 'active'
       ORDER BY wd.created_at ASC
       LIMIT $2
       FOR UPDATE OF wd SKIP LOCKED`,
            [MAX_ATTEMPTS, BATCH_SIZE]
        );

        if (deliveriesResult.rows.length === 0) {
            return 0;
        }

        let delivered = 0;

        for (const delivery of deliveriesResult.rows) {
            const event = {
                id: delivery.event_id,
                type: delivery.type,
                created_at: delivery.event_created_at,
                payload: delivery.payload
            };

            const subscription = {
                url: delivery.url,
                secret: delivery.secret
            };

            const result = await deliverWebhook(subscription, event, delivery.id);

            if (result.success) {
                // Success - mark as completed
                await pool.controlPool.query(
                    `UPDATE webhook_deliveries 
           SET status = 'success', response_code = $1, response_body = $2, 
               duration_ms = $3, completed_at = NOW(), attempt = attempt + 1
           WHERE id = $4`,
                    [result.statusCode, result.responseBody, result.durationMs, delivery.id]
                );

                // Update subscription stats
                await pool.controlPool.query(
                    `UPDATE webhook_subscriptions 
           SET last_success_at = NOW(), failure_count = 0 
           WHERE id = $1`,
                    [delivery.subscription_id]
                );

                delivered++;
            } else {
                // Failure - schedule retry or abandon
                const attemptNum = delivery.attempt + 1;

                if (attemptNum >= MAX_ATTEMPTS) {
                    // Max attempts reached - abandon
                    await pool.controlPool.query(
                        `UPDATE webhook_deliveries 
             SET status = 'abandoned', response_code = $1, last_error = $2,
                 duration_ms = $3, completed_at = NOW(), attempt = $4
             WHERE id = $5`,
                        [result.statusCode, result.error || result.responseBody, result.durationMs, attemptNum, delivery.id]
                    );

                    // Update subscription failure count
                    await pool.controlPool.query(
                        `UPDATE webhook_subscriptions 
             SET last_failure_at = NOW(), failure_count = failure_count + 1 
             WHERE id = $1`,
                        [delivery.subscription_id]
                    );

                    // Auto-disable if too many failures
                    await pool.controlPool.query(
                        `UPDATE webhook_subscriptions 
             SET status = 'failed' 
             WHERE id = $1 AND failure_count >= 10`,
                        [delivery.subscription_id]
                    );
                } else {
                    // Schedule retry
                    const retryDelay = RETRY_DELAYS_MS[attemptNum - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
                    const nextRetry = new Date(Date.now() + retryDelay);

                    await pool.controlPool.query(
                        `UPDATE webhook_deliveries 
             SET attempt = $1, next_retry_at = $2, last_error = $3, 
                 response_code = $4, duration_ms = $5
             WHERE id = $6`,
                        [attemptNum, nextRetry, result.error || result.responseBody, result.statusCode, result.durationMs, delivery.id]
                    );
                }
            }
        }

        return delivered;
    } catch (error) {
        console.error('[WebhookWorker] Error processing deliveries:', error);
        return 0;
    }
}

/**
 * Main worker loop
 */
let isRunning = false;
let pollTimeout = null;

async function runWorkerCycle() {
    if (!isRunning) return;

    try {
        const outboxProcessed = await processOutboxEvents();
        const deliveriesProcessed = await processDeliveries();

        if (outboxProcessed > 0 || deliveriesProcessed > 0) {
            console.log(`[WebhookWorker] Processed ${outboxProcessed} outbox events, ${deliveriesProcessed} deliveries`);
        }
    } catch (error) {
        console.error('[WebhookWorker] Cycle error:', error);
    }

    // Schedule next cycle
    if (isRunning) {
        pollTimeout = setTimeout(runWorkerCycle, POLL_INTERVAL_MS);
    }
}

/**
 * Start the webhook delivery worker
 */
function startWorker() {
    if (isRunning) {
        console.log('[WebhookWorker] Already running');
        return;
    }

    isRunning = true;
    console.log('[WebhookWorker] Starting webhook delivery worker');
    runWorkerCycle();
}

/**
 * Stop the webhook delivery worker
 */
function stopWorker() {
    isRunning = false;
    if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
    }
    console.log('[WebhookWorker] Stopped');
}

/**
 * Manually trigger processing (useful for testing)
 */
async function triggerProcessing() {
    await processOutboxEvents();
    await processDeliveries();
}

module.exports = {
    startWorker,
    stopWorker,
    triggerProcessing
};
