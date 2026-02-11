const pool = require('../db');
const emailService = require('./emailService');

/**
 * GracePeriodService
 * 
 * Implements the 45-day progressive grace period (Option A):
 * Phase 1 (Day 1-15): Warning. Full access.
 * Phase 2 (Day 16-30): Degraded. Read-only mode.
 * Phase 3 (Day 31-45): Locked. Full lockout.
 * Phase 4 (Day 46+): Terminated. Canceled.
 */
class GracePeriodService {
    /**
     * Tiers and their associated side effects
     */
    static PHASES = {
        ACTIVE: 0,
        WARNING: 1,
        READ_ONLY: 2,
        LOCKED: 3,
        TERMINATED: 4
    };

    /**
     * Process all clinics that are currently in a grace period.
     * This is intended to be called by a daily cron job.
     */
    async processEscalations() {
        console.log('[GracePeriodService] Starting daily escalation check...');

        // Find clinics that are NOT active (phase > 0 or have a grace_start_at)
        // or clinics that just missed a payment (past_due/unpaid but phase is still 0)
        const res = await pool.controlPool.query(`
            SELECT id, display_name, slug, schema_name, status, is_read_only, billing_locked, 
                   stripe_subscription_status, billing_grace_phase, billing_grace_start_at,
                   billing_manual_override, trial_expiry_at
              FROM clinics
             WHERE billing_manual_override = false
               AND (
                   billing_grace_phase > 0 
                   OR stripe_subscription_status IN ('past_due', 'unpaid')
                   OR (
                       (stripe_subscription_status IS NULL OR stripe_subscription_status NOT IN ('active', 'trialing'))
                       AND trial_expiry_at < NOW()
                   )
               )
        `);

        for (const clinic of res.rows) {
            try {
                await this.evaluateClinic(clinic);
            } catch (err) {
                console.error(`[GracePeriodService] Failed to evaluate clinic ${clinic.display_name}:`, err);
            }
        }

        console.log(`[GracePeriodService] Processed ${res.rows.length} clinics.`);
    }

    /**
     * Log a dunning event to the database.
     */
    async logEvent(clinicId, eventType, prevPhase, currPhase, details) {
        try {
            await pool.controlPool.query(`
                INSERT INTO clinic_dunning_logs (clinic_id, event_type, previous_phase, current_phase, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [clinicId, eventType, prevPhase, currPhase, JSON.stringify(details)]);
        } catch (err) {
            console.error('[GracePeriodService] Failed to log dunning event:', err);
        }
    }

    /**
     * Evaluate a single clinic's status and escalate if needed.
     */
    async evaluateClinic(clinic) {
        const now = new Date();
        let graceStart = clinic.billing_grace_start_at ? new Date(clinic.billing_grace_start_at) : null;
        let currentPhase = clinic.billing_grace_phase || 0;

        // 1. Check if the clinic has paid and is now active
        if (clinic.stripe_subscription_status === 'active') {
            if (currentPhase !== GracePeriodService.PHASES.ACTIVE) {
                console.log(`[GracePeriodService] Clinic ${clinic.display_name} is now ACTIVE. Resetting grace period.`);
                await this.resetClinic(clinic.id, currentPhase);
            }
            return;
        }

        // 2. Determine if dunning should be active
        const isSubscriptionFailure = ['past_due', 'unpaid', 'canceled'].includes(clinic.stripe_subscription_status);
        const isTrialExpired = (clinic.stripe_subscription_status === null || clinic.stripe_subscription_status === 'none') &&
            (clinic.trial_expiry_at && new Date(clinic.trial_expiry_at) < now);

        if (!graceStart && (isSubscriptionFailure || isTrialExpired)) {
            console.log(`[GracePeriodService] Initializing grace period for clinic ${clinic.display_name} (Reason: ${isTrialExpired ? 'Trial Expired' : 'Payment Failure'})`);
            graceStart = now;
            await pool.controlPool.query(
                "UPDATE clinics SET billing_grace_start_at = $1, billing_grace_phase = 1 WHERE id = $2",
                [graceStart, clinic.id]
            );

            const details = isTrialExpired ? { message: 'Trial period expired without subscription' } : { message: 'First payment failure detected' };
            await this.logEvent(clinic.id, 'phase_initialized', 0, 1, details);
            await this.sendDunningEmail(clinic, 1);
            return;
        }

        // 3. Calculate days elapsed
        const daysElapsed = Math.floor((now - graceStart) / (1000 * 60 * 60 * 24));
        let targetPhase = currentPhase;

        if (daysElapsed >= 45) {
            targetPhase = GracePeriodService.PHASES.TERMINATED;
        } else if (daysElapsed >= 30) {
            targetPhase = GracePeriodService.PHASES.LOCKED;
        } else if (daysElapsed >= 15) {
            targetPhase = GracePeriodService.PHASES.READ_ONLY;
        } else {
            targetPhase = GracePeriodService.PHASES.WARNING;
        }

        // 4. If phase needs to change or it's a specific milestone for reminder emails
        if (targetPhase !== currentPhase) {
            await this.escalateToPhase(clinic, targetPhase, currentPhase);
        } else {
            // Check for intermediate reminder emails (Day 7, 14)
            if (targetPhase === GracePeriodService.PHASES.WARNING) {
                if (daysElapsed === 7 || daysElapsed === 14) {
                    await this.sendDunningEmail(clinic, targetPhase, daysElapsed);
                }
            }
        }
    }

    /**
     * Escalate clinic to a new phase and apply side effects.
     */
    async escalateToPhase(clinic, phase, prevPhase) {
        console.log(`[GracePeriodService] Escalating clinic ${clinic.display_name} to Phase ${phase}`);

        let is_read_only = clinic.is_read_only;
        let billing_locked = clinic.billing_locked;
        let status = clinic.status;

        switch (phase) {
            case GracePeriodService.PHASES.WARNING:
                // No changes to access
                break;
            case GracePeriodService.PHASES.READ_ONLY:
                is_read_only = true;
                break;
            case GracePeriodService.PHASES.LOCKED:
                is_read_only = true;
                billing_locked = true;
                status = 'suspended'; // Fully suspend the clinic account
                break;
            case GracePeriodService.PHASES.TERMINATED:
                status = 'deactivated'; // Mark clinic itself as deactivated
                billing_locked = true;
                break;
        }

        await pool.controlPool.query(`
            UPDATE clinics 
               SET billing_grace_phase = $1,
                   is_read_only = $2,
                   billing_locked = $3,
                   status = $4
             WHERE id = $5`,
            [phase, is_read_only, billing_locked, status, clinic.id]
        );

        await this.logEvent(clinic.id, 'phase_escalated', prevPhase, phase, {
            days_elapsed: Math.floor((new Date() - new Date(clinic.billing_grace_start_at)) / (1000 * 60 * 60 * 24))
        });

        await this.sendDunningEmail(clinic, phase);
    }

    /**
     * Reset grace period data when clinic becomes active again.
     */
    async resetClinic(clinicId, prevPhase) {
        await pool.controlPool.query(`
            UPDATE clinics 
               SET billing_grace_phase = 0,
                   billing_grace_start_at = NULL,
                   is_read_only = false,
                   billing_locked = false,
                   status = 'active'
             WHERE id = $1`,
            [clinicId]
        );

        await this.logEvent(clinicId, 'grace_period_reset', prevPhase, 0, { message: 'Full payment received' });
    }

    /**
     * Send phase-specific dunning emails.
     */
    async sendDunningEmail(clinic, phase, days = null) {
        // Find clinic admin email - must use the correct schema
        const schema = clinic.schema_name;
        if (!schema) {
            console.warn(`[GracePeriodService] No schema_name found for clinic ${clinic.display_name}. Cannot send email.`);
            return;
        }

        const adminRes = await pool.controlPool.query(`
            SELECT email, first_name 
              FROM ${schema}.users 
             WHERE role ILIKE 'admin' AND status = 'active'
             LIMIT 1
        `);

        const admin = adminRes.rows[0];
        if (!admin) {
            console.warn(`[GracePeriodService] No active admin found for clinic ${clinic.display_name} to send email.`);
            return;
        }

        console.log(`[GracePeriodService] Sending Phase ${phase} email to ${admin.email} (Days: ${days || 'N/A'})`);

        try {
            let emailResult = { sent: false };
            let emailType = '';

            if (phase === GracePeriodService.PHASES.WARNING) {
                if (days === 7 || days === 14) {
                    emailResult = await emailService.sendBillingReminder(admin.email, admin.first_name, clinic.display_name, days);
                    emailType = `reminder_day_${days}`;
                } else {
                    emailResult = await emailService.sendBillingWarning(admin.email, admin.first_name, clinic.display_name, 15);
                    emailType = 'initial_warning';
                }
            } else if (phase === GracePeriodService.PHASES.READ_ONLY) {
                emailResult = await emailService.sendBillingReadOnlyNotice(admin.email, admin.first_name, clinic.display_name);
                emailType = 'read_only_notice';
            } else if (phase === GracePeriodService.PHASES.LOCKED) {
                emailResult = await emailService.sendBillingLockoutNotice(admin.email, admin.first_name, clinic.display_name);
                emailType = 'lockout_notice';
            } else if (phase === GracePeriodService.PHASES.TERMINATED) {
                emailResult = await emailService.sendBillingTerminationNotice(admin.email, admin.first_name, clinic.display_name);
                emailType = 'termination_notice';
            }

            if (emailType) {
                await this.logEvent(clinic.id, 'email_sent', phase, phase, {
                    email_type: emailType,
                    recipient: admin.email,
                    subject: emailResult.subject,
                    body_html: emailResult.html,
                    sent_success: emailResult.sent
                });
            }
        } catch (err) {
            console.error(`[GracePeriodService] Email delivery failed:`, err.message);
        }
    }
}

module.exports = new GracePeriodService();
