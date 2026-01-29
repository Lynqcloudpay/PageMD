const nodemailer = require('nodemailer');

/**
 * Email Service
 * 
 * Commercial-grade email service for sending portal invitations, 
 * password resets, and notifications.
 */

class EmailService {
    constructor() {
        this.enabled = process.env.EMAIL_ENABLED === 'true';
        this.from = process.env.EMAIL_FROM || 'noreply@pagemdemr.com';

        // SMTP Config
        this.config = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            secure: process.env.SMTP_SECURE === 'true' // true for 465, false for other ports
        };

        if (this.enabled && this.config.host) {
            this.transporter = nodemailer.createTransport(this.config);
            console.log(`[EmailService] Initialized with SMTP host: ${this.config.host}`);
        } else {
            console.log('[EmailService] SMTP not fully configured or disabled. Falling back to console logging.');
        }
    }

    /**
     * Send Portal Invitation
     */
    async sendPortalInvite(email, patientName, inviteLink) {
        const subject = `Welcome to PageMD Patient Portal - Invitation from your Clinic`;
        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <h2 style="color: #2563eb;">Hello ${patientName},</h2>
                <p style="font-size: 16px; line-height: 1.6;">Your healthcare provider has invited you to join the PageMD Patient Portal.</p>
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
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <h2 style="color: #2563eb;">Password Reset Request</h2>
                <p style="font-size: 16px; line-height: 1.6;">We received a request to reset your password for the PageMD Patient Portal.</p>
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
    async sendNewMessageNotification(email, patientName) {
        const subject = `New Secure Message in your Patient Portal`;
        const portalUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/portal` : 'https://pagemdemr.com/portal';

        const html = `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #2563eb; margin-bottom: 10px;">New Secure Message</h2>
                    <div style="width: 50px; h-px; background-color: #2563eb; margin: 10px auto;"></div>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6;">Hello ${patientName || 'Patient'},</p>
                <p style="font-size: 16px; line-height: 1.6;">You have received a new secure message from your healthcare provider in the Patient Portal.</p>
                
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
     * Internal send method
     */
    async _send(to, subject, html) {
        console.log(`[EmailService] 📧 Preparing email for: ${to}`);

        if (this.enabled && this.transporter) {
            try {
                const info = await this.transporter.sendMail({
                    from: `"PageMD Support" <${this.from}>`,
                    to,
                    subject,
                    html
                });
                console.log(`[EmailService] ✅ Email sent: ${info.messageId}`);
                return true;
            } catch (error) {
                console.error(`[EmailService] ❌ Failed to send email via SMTP:`, error.message);
                return false;
            }
        }

        // Fallback for dev/test or when SMTP is not configured
        console.log(`[EmailService] 📝 LOG ONLY (SMTP not configured)`);
        console.log(`[EmailService] Target: ${to}`);
        console.log(`[EmailService] Subject: ${subject}`);
        // console.log(`[EmailService] HTML Content:`, html.slice(0, 500) + '...');

        return true;
    }
}

module.exports = new EmailService();
