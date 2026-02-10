const { Resend } = require('resend');

/**
 * Email Service
 * 
 * Commercial-grade email service for sending portal invitations, 
 * password resets, and notifications. 
 * Now powered exclusively by Resend.
 */

class EmailService {
    constructor() {
        this.enabled = process.env.EMAIL_ENABLED === 'true';
        this.apiKey = process.env.RESEND_API_KEY;
        this.from = process.env.EMAIL_FROM || 'noreply@pagemdemr.com';

        if (this.enabled && this.apiKey) {
            this.resend = new Resend(this.apiKey);
            console.log(`[EmailService] Initialized with Resend API Key`);
        } else {
            console.warn('[EmailService] Resend API Key missing or service disabled. Falling back to console logging.');
        }
    }

    /**
     * Send Referral Invitation
     */
    async sendReferralInvite(email, recipientName, referrerClinicName, inviteLink) {
        const subject = `You've been invited to PageMD by ${referrerClinicName}`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://pagemdemr.com/logo.png" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0;">
                </div>
                <h2 style="color: #2563eb; text-align: center;">Hello ${recipientName || 'Doctor'},</h2>
                <p style="font-size: 16px; line-height: 1.6; text-align: center;"><strong>${referrerClinicName}</strong> has invited you to join the PageMD Partner Program.</p>
                <p style="font-size: 16px; line-height: 1.6;">PageMD is the first EMR that rewards your growth. By joining through this invitation, you'll receive a special introductory rate and help your colleague earn rewards too.</p>
                <div style="margin: 40px 0; text-align: center;">
                    <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        Accept Invitation & Learn More
                    </a>
                </div>
                <p style="font-size: 14px; color: #64748b; margin-top: 40px;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; color: #3b82f6; word-break: break-all;">${inviteLink}</p>
                <p style="font-size: 14px; color: #64748b;">This special introductory link will expire in 30 days.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} PageMD EMR. All rights reserved.</p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send Portal Invitation
     */
    async sendPortalInvite(email, patientName, inviteLink) {
        const subject = `Welcome to PageMD Patient Portal - Invitation from your Clinic`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://pagemdemr.com/logo.png" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0;">
                </div>
                <h2 style="color: #2563eb; text-align: center;">Hello ${patientName},</h2>
                <p style="font-size: 16px; line-height: 1.6; text-align: center;">Your healthcare provider has invited you to join the PageMD Patient Portal.</p>
                <p style="font-size: 16px; line-height: 1.6;">Through this secure portal, you can view your health records, message your doctor, and request appointments.</p>
                <div style="margin: 40px 0; text-align: center;">
                    <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        Complete Your Registration
                    </a>
                </div>
                <p style="font-size: 14px; color: #64748b; margin-top: 40px;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; color: #3b82f6; word-break: break-all;">${inviteLink}</p>
                <p style="font-size: 14px; color: #64748b;">This invitation link will expire in 72 hours.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} PageMD EMR. All rights reserved.</p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send Password Reset
     */
    async sendPasswordReset(email, resetLink) {
        const subject = `PageMD Portal - Password Reset Request`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://pagemdemr.com/logo.png" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0;">
                </div>
                <h2 style="color: #2563eb; text-align: center;">Password Reset Request</h2>
                <p style="font-size: 16px; line-height: 1.6; text-align: center;">We received a request to reset your password for the PageMD Patient Portal.</p>
                <div style="margin: 40px 0; text-align: center;">
                    <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        Reset My Password
                    </a>
                </div>
                <p style="font-size: 14px; color: #64748b;">This link will expire in 1 hour.</p>
                <p style="font-size: 14px; color: #64748b;">If you did not request this, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} PageMD EMR. All rights reserved.</p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send New Message Notification
     */
    async sendNewMessageNotification(email, patientName, senderName) {
        const subject = `New Secure Message from ${senderName || 'your provider'}`;
        const portalUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/portal` : 'https://pagemdemr.com/portal';

        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #2563eb; margin-bottom: 10px;">New Secure Message</h2>
                    <div style="width: 50px; height: 2px; background-color: #2563eb; margin: 10px auto;"></div>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6;">Hello ${patientName || 'Patient'},</p>
                <p style="font-size: 16px; line-height: 1.6;">You have received a new secure message from <strong>${senderName || 'your healthcare provider'}</strong> in the Patient Portal.</p>
                
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border-left: 4px solid #3b82f6; margin: 30px 0;">
                    <p style="font-size: 14px; color: #475569; margin: 0;">For your security and privacy, you must log in to the portal to view the content of this message and reply.</p>
                </div>

                <div style="margin: 40px 0; text-align: center;">
                    <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);">
                        View Message in Portal
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">This is an automated notification. Please do not reply directly to this email as the inbox is not monitored.</p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} PageMD EMR. All rights reserved.</p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send Demo Verification Code for Sandbox Access
     * @param {string} email - User's email
     * @param {string} userName - User's name
     * @param {string} code - The 6-digit verification code
     */
    async sendDemoVerificationCode(email, userName, code) {
        const subject = `PageMD Verification Code: ${code}`;
        const logoUrl = 'https://pagemdemr.com/logo.png';

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b; line-height: 1.6; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                <div style="background-color: #f8fafc; padding: 32px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                    <img src="${logoUrl}" alt="PageMD" width="137" height="40" style="height: 40px; width: auto; border: 0;">
                </div>
                
                <div style="padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.025em;">Verify Your Email</h1>
                    
                    <p style="margin-bottom: 32px; font-size: 15px; color: #475569;">
                        Hi ${userName || 'there'}, use the verification code below to launch your PageMD sandbox demo.
                    </p>
                    
                    <div style="background-color: #eff6ff; padding: 24px 10px; border-radius: 16px; font-size: 32px; font-weight: 800; letter-spacing: 0.1em; color: #2563eb; font-family: 'SF Mono', Consolas, monospace; border: 1px solid #dbeafe; display: block; white-space: nowrap; margin: 0 auto; width: 100%; box-sizing: border-box;">
                        ${code}
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
                        Expires in 45 minutes
                    </p>
                </div>
                
                <div style="padding: 32px; background-color: #f8fafc; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-weight: 600;">PageMD EMR • HIPAA Compliant Sandbox</p>
                    <p style="margin: 8px 0 0 0;">PageMD HQ • 1101 Brickell Ave, Miami, FL 33131</p>
                    <p style="margin: 4px 0 0 0;">If you didn't request this, please ignore this email.</p>
                </div>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send Demo Magic Link for Sandbox Verification
     * @param {string} email - User's email
     * @param {string} userName - User's name
     * @param {string} magicLink - The verification link
     */
    async sendDemoMagicLink(email, userName, magicLink) {
        const subject = `Welcome to PageMD - Your Demo Link`;
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; padding: 40px 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://pagemdemr.com/logo.png" alt="PageMD" style="height: 40px; margin-bottom: 20px;">
                        <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Welcome, ${userName || 'Doctor'}!</h1>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 20px;">
                        Thank you for your interest in PageMD. Click the button below to launch your personal sandbox demo environment.
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">
                            Launch My Demo →
                        </a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
                        Link expires in 45 minutes for security purposes.
                    </p>
                    
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">
                        If the button doesn't work, copy and paste this link into your browser:<br/>
                        <a href="${magicLink}" style="color: #3b82f6; word-break: break-all;">${magicLink}</a>
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p style="font-size: 12px; color: #94a3b8;">
                        © ${new Date().getFullYear()} PageMD EMR. All rights reserved.<br/>
                        HIPAA Compliant • Secure • Simple
                    </p>
                </div>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Send Referral Activity Notification to Referrer
     * @param {string} email - Referrer's email
     * @param {string} referrerName - Referrer's name
     * @param {string} leadName - Name of the lead who used the link
     * @param {string} type - 'invite' (email invite) or 'link' (static link)
     */
    async sendReferralNotification(email, referrerName, leadName, type = 'link') {
        const subject = `Good news! Your referral link was used`;
        const logoUrl = 'https://pagemdemr.com/logo.png';

        const message = type === 'invite'
            ? `Your invitation to <strong>${leadName}</strong> has been accepted! They have started the signup process.`
            : `Someone used your referral link! <strong>${leadName}</strong> has started the signup process thanks to you.`;

        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="${logoUrl}" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0;">
                </div>
                <h2 style="color: #2563eb; text-align: center;">New Referral Activity!</h2>
                
                <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
                    <p style="font-size: 18px; line-height: 1.6; color: #0369a1; margin: 0;">
                        ${message}
                    </p>
                </div>

                <p style="font-size: 16px; line-height: 1.6; text-align: center; color: #475569;">
                    This brings you one step closer to your next reward tier. You can track your referrals and earnings in your settings dashboard.
                </p>

                <div style="margin: 40px 0; text-align: center;">
                    <a href="https://admin.pagemdemr.com/admin-settings?tab=rewards" style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        View Verified Referrals
                    </a>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                    © ${new Date().getFullYear()} PageMD EMR. All rights reserved.
                </p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Dunning: Send Phase 1 Initial Warning
     */
    async sendBillingWarning(email, name, clinicName, graceDays = 15) {
        const subject = `Action Required: Payment Failed for ${clinicName}`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://pagemdemr.com/logo.png" alt="PageMD" height="40">
                </div>
                <h2 style="color: #0f172a;">Hi ${name},</h2>
                <p style="font-size: 16px; line-height: 1.6;">We were unable to process your subscription payment for <strong>${clinicName}</strong>. This is often due to an expired card or changed billing details.</p>
                
                <div style="background-color: #eff6ff; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 0; font-weight: 600; color: #1e40af;">Grace Period Active</p>
                    <p style="margin: 8px 0 0 0; color: #1e40af;">Your account is in a <strong>${graceDays}-day grace period</strong>. Your services will remain fully active during this time.</p>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://admin.pagemdemr.com/admin-settings?tab=practice" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Update Payment Method</a>
                </div>

                <p style="font-size: 14px; color: #64748b;">If payment is not received within 15 days, your account will move to Read-Only mode to ensure patient data remains accessible while modifications are disabled.</p>
            </div>
        `;
        return this._send(email, subject, html);
    }

    /**
     * Dunning: Send Billing Reminder (Day 7/14)
     */
    async sendBillingReminder(email, name, clinicName, daysElapsed) {
        const subject = `Reminder: Payment for ${clinicName} is Overdue`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #0f172a;">Payment Reminder</h2>
                <p style="font-size: 16px; line-height: 1.6;">Hi ${name}, just a friendly reminder that we still haven't received your subscription payment for ${clinicName}. It has been ${daysElapsed} days since the initial failure.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://admin.pagemdemr.com/admin-settings?tab=practice" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Resolve Now</a>
                </div>
            </div>
        `;
        return this._send(email, subject, html);
    }

    /**
     * Dunning: Phase 2 Read-Only Notice (Day 16)
     */
    async sendBillingReadOnlyNotice(email, name, clinicName) {
        const subject = `Urgent: ${clinicName} Account Moved to Read-Only Mode`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #dc2626;">Account Now Read-Only</h2>
                <p style="font-size: 16px; line-height: 1.6;">Hi ${name}, your 15-day full access grace period has expired for ${clinicName}.</p>
                <p style="font-size: 16px; line-height: 1.6;">Your account has been moved to <strong>Read-Only Mode</strong>. You can still view patient charts and export data, but creating new records or scheduling is disabled until payment is resolved.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://admin.pagemdemr.com/admin-settings?tab=practice" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Unlock Account</a>
                </div>
            </div>
        `;
        return this._send(email, subject, html);
    }

    /**
     * Dunning: Phase 3 Lockdown Notice (Day 31)
     */
    async sendBillingLockoutNotice(email, name, clinicName) {
        const subject = `Critical: ${clinicName} Service Interrupted`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #991b1b;">Service Suspended</h2>
                <p style="font-size: 16px; line-height: 1.6;">Hi ${name}, it has been 30 days since your payment failed. Your access to PageMD has been locked.</p>
                <p style="font-size: 16px; line-height: 1.6;">To restore service immediately, please update your payment details below. Your data is protected and will be available once the account is reactivated.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://admin.pagemdemr.com/admin-settings?tab=practice" style="background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Restore Service</a>
                </div>
            </div>
        `;
        return this._send(email, subject, html);
    }

    /**
     * Dunning: Phase 4 Termination Notice (Day 46)
     */
    async sendBillingTerminationNotice(email, name, clinicName) {
        const subject = `Notice of Service Termination: ${clinicName}`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #0f172a;">Service Terminated</h2>
                <p style="font-size: 16px; line-height: 1.6;">Hi ${name}, we have terminated your subscription for ${clinicName} due to prolonged non-payment (+45 days).</p>
                <p style="font-size: 16px; line-height: 1.6;">Your clinical data will be retained for 90 days for HIPAA compliance. You can still access your data for export purposes via the platform link below.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://admin.pagemdemr.com/admin-settings" style="background: #475569; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Access Export Portal</a>
                </div>
            </div>
        `;
        return this._send(email, subject, html);
    }

    /**
     * Send Guest Access Link for Telehealth
     * Magic link for patients who can't log into the portal
     */
    async sendGuestAccessLink(email, patientName, providerName, appointmentTime, guestLink, clinicPhone) {
        const subject = `Link for Your Appointment with ${providerName}`;
        const html = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://pagemdemr.com/logo.png" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0;">
                </div>
                
                <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px; font-size: 24px;">Your Video Visit Link</h2>
                
                <p style="font-size: 16px; line-height: 1.6; text-align: center; color: #64748b; margin-bottom: 24px;">
                    Hi ${patientName}, we noticed you might be having trouble accessing the portal. Here is a direct, one-time link to your video room.
                </p>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Appointment</p>
                    <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${appointmentTime}</p>
                    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">with ${providerName}</p>
                </div>
                
                <div style="margin: 32px 0; text-align: center;">
                    <a href="${guestLink}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                        Join Video Visit Now
                    </a>
                </div>
                
                <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #92400e;">
                        <strong>🔒 Security Note:</strong> This link is valid for this appointment only. You may be asked to confirm your Date of Birth for verification.
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    If you have questions or need to reschedule, please call us at:<br>
                    <a href="tel:${clinicPhone}" style="color: #2563eb; font-weight: 600; text-decoration: none;">${clinicPhone}</a>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} PageMD EMR. All rights reserved.<br>This is a secure, HIPAA-compliant communication.</p>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
    * Send Demo Invitation
    */
    async sendDemoInvitation(email, leadName, sellerName, date, meetingLink, confirmUrl, denyUrl) {
        const subject = `Demo Invitation: PageMD EMR with ${sellerName}`;
        const logoUrl = 'https://pagemdemr.com/logo.png';

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; background-color: #f8fafc; padding: 40px 20px;">
                <div style="background-color: #ffffff; border-radius: 20px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <a href="https://pagemdemr.com" style="text-decoration: none;">
                            <img src="${logoUrl}" alt="PageMD" width="164" height="48" style="height: 48px; width: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;">
                        </a>
                        <h1 style="color: #0f172a; font-size: 28px; font-weight: 800; margin: 24px 0 0 0; letter-spacing: -0.02em;">Demo Invitation</h1>
                        <p style="color: #64748b; font-size: 16px; margin-top: 8px;">Your interactive walkthrough is ready</p>
                    </div>
                    
                    <div style="margin-bottom: 40px; text-align: center; padding: 0 20px;">
                        <p style="font-size: 17px; line-height: 1.6; color: #475569; margin: 0;">
                            Hi ${leadName}, your PageMD EMR demo has been scheduled with <strong>${sellerName}</strong>. We're excited to show you the platform and answer your questions.
                        </p>
                    </div>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px; margin-bottom: 40px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td style="padding-bottom: 24px;">
                                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px;">Date & Time</div>
                                    <div style="color: #0f172a; font-size: 18px; font-weight: 700;">${date}</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding-bottom: 24px;">
                                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px;">Meeting Location</div>
                                    <a href="${meetingLink}" style="color: #2563eb; font-size: 18px; font-weight: 700; text-decoration: none; border-bottom: 2px solid #dbeafe;">Join Video Call</a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px;">Lead Presenter</div>
                                    <div style="color: #0f172a; font-size: 18px; font-weight: 700;">${sellerName}</div>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr>
                            <td align="center" style="padding-bottom: 12px;">
                                <a href="${confirmUrl}" style="display: block; background-color: #2563eb; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; text-align: center; border: 1px solid #2563eb;">Confirm Attendance</a>
                            </td>
                        </tr>
                        <tr>
                            <td align="center">
                                <a href="${denyUrl}" style="display: block; background-color: #ffffff; color: #dc2626; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; text-align: center; border: 1px solid #ef4444;">Decline Invitation</a>
                            </td>
                        </tr>
                    </table>
                    
                    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
                        Need help? Reply to this email or visit our <a href="https://pagemdemr.com/support" style="color: #3b82f6; text-decoration: none;">support center</a>.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 32px;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        PageMD EMR • 1101 Brickell Ave, Miami, FL 33131
                    </p>
                </div>
            </div>
        `;

        return this._send(email, subject, html);
    }

    /**
     * Internal send method
     */
    async _send(to, subject, html) {
        // Robust email cleaning
        const cleanTo = typeof to === 'string' ? to.trim() : to;

        // SANDBOX ISOLATION: NOP all emails in demo mode
        const { isSandboxMode } = require('./simulationInterceptor');
        if (isSandboxMode()) {
            console.log(`[Simulation] 🛡️ EMAIL NOPed for Sandbox. To: ${cleanTo}, Subject: ${subject}`);
            return true;
        }

        console.log(`[EmailService] 📧 Preparing email via Resend for: ${cleanTo}`);

        if (!cleanTo || (typeof cleanTo === 'string' && !cleanTo.includes('@'))) {
            console.error(`[EmailService] ❌ Invalid email address: ${cleanTo}`);
            return false;
        }

        if (this.enabled && this.resend) {
            try {
                const { data, error } = await this.resend.emails.send({
                    from: `"PageMD" <${this.from}>`,
                    to: [cleanTo],
                    subject: subject,
                    html: html,
                    headers: {
                        'X-Entity-Ref-ID': Date.now().toString(),
                    }
                });

                if (error) {
                    console.error(`[EmailService] ❌ Resend Error:`, error);
                    return false;
                }

                console.log(`[EmailService] ✅ Email sent via Resend: ${data.id}`);
                return true;
            } catch (error) {
                console.error(`[EmailService] ❌ Failed to send email via Resend:`, error.message);
                return false;
            }
        }

        // Fallback for dev/test or when Resend is not configured
        console.log(`[EmailService] 📝 LOG ONLY (Resend not configured)`);
        console.log(`[EmailService] Target: ${to}`);
        console.log(`[EmailService] Subject: ${subject}`);

        return true;
    }
}

module.exports = new EmailService();
