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
                    <img src="${logoUrl}" alt="PageMD" style="height: 40px; width: auto;">
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
     * Send Demo Invitation
     */
    async sendDemoInvitation(email, leadName, sellerName, date, zoomLink, confirmUrl, denyUrl) {
        const subject = `Demo Invitation: PageMD EMR with ${sellerName}`;
        const logoUrl = 'https://pagemdemr.com/logo.png';

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; background-color: #f8fafc; padding: 40px 20px;">
                <div style="background-color: #ffffff; border-radius: 20px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <img src="${logoUrl}" alt="PageMD" style="height: 48px; width: auto; display: block; margin: 0 auto 32px;">
                        <h1 style="color: #0f172a; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">Demo Invitation</h1>
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
                                    <a href="${zoomLink}" style="color: #2563eb; font-size: 18px; font-weight: 700; text-decoration: none; border-bottom: 2px solid #dbeafe;">Join Video Call</a>
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
                                <a href="${denyUrl}" style="display: block; background-color: #ffffff; color: #64748b; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; text-align: center; border: 1px solid #e2e8f0;">Reschedule Demo</a>
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
        console.log(`[EmailService] 📧 Preparing email for: ${to}`);

        if (!this.transporter) {
            console.error('[EmailService] ❌ Transporter not initialized. Re-initializing...');
            this._initialize();
            if (!this.transporter) return false;
        }

        const mailOptions = {
            from: `"PageMD Support" <support@pagemdemr.com>`, // Fixed as requested
            to,
            subject,
            html,
            headers: {
                'X-Entity-Ref-ID': Date.now().toString(),
                'List-Unsubscribe': '<mailto:support@pagemdemr.com?subject=unsubscribe>'
            }
        };

        if (this.enabled && this.transporter) {
            try {
                const info = await this.transporter.sendMail(mailOptions);
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
