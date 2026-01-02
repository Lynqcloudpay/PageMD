/**
 * Email Service
 * 
 * Commercial-grade email service for sending portal invitations, 
 * password resets, and notifications.
 * Currently supports Console Logging (Dev/Test) and is ready for SMTP.
 */

class EmailService {
    constructor() {
        this.enabled = process.env.EMAIL_ENABLED === 'true';
        this.from = process.env.EMAIL_FROM || 'noreply@pagemd.com';

        // SMTP Config (Future implementation)
        this.smtpConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        };
    }

    /**
     * Send Portal Invitation
     */
    async sendPortalInvite(email, patientName, inviteLink) {
        const subject = `Welcome to PageMD Patient Portal - Invitation from your Clinic`;
        const body = `
            <h2>Hello ${patientName},</h2>
            <p>Your healthcare provider has invited you to join the PageMD Patient Portal.</p>
            <p>Through this secure portal, you can view your health records, message your doctor, and request appointments.</p>
            <div style="margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Complete Your Registration
                </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p>${inviteLink}</p>
            <p>This invitation link will expire in 7 days.</p>
            <hr />
            <p style="font-size: 12px; color: #64748b;">If you did not expect this email, please ignore it.</p>
        `;

        return this._send(email, subject, body);
    }

    /**
     * Send Password Reset
     */
    async sendPasswordReset(email, resetLink) {
        const subject = `PageMD Portal - Password Reset Request`;
        const body = `
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password for the PageMD Patient Portal.</p>
            <div style="margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Reset My Password
                </a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
        `;

        return this._send(email, subject, body);
    }

    /**
     * Internal send method
     */
    async _send(to, subject, body) {
        console.log(`[EmailService] 📧 Sending to: ${to}`);
        console.log(`[EmailService] Subject: ${subject}`);

        if (this.enabled) {
            // TODO: Implement actual SMTP sending with nodemailer
            console.log('[EmailService] (SMTP Sending is not yet configured, falling back to log)');
        }

        // For development/testing, we always log the output
        if (process.env.NODE_ENV !== 'production') {
            // console.log('[EmailService] Body Preview:', body.replace(/<[^>]*>/g, '').slice(0, 200) + '...');
        }

        return true;
    }
}

module.exports = new EmailService();
