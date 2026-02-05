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
        const subject = `${code} is your PageMD Demo access code`;
        const logoUrl = 'https://pagemdemr.com/logo.png';

        const html = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; background-color: #f8fafc; padding: 48px 20px;">
                <div style="background-color: #ffffff; border-radius: 24px; padding: 48px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
                    
                    <div style="text-align: center; margin-bottom: 40px;">
                        <img src="${logoUrl}" alt="PageMD Logo" style="height: 44px; width: auto; margin-bottom: 24px; display: inline-block;">
                        <h1 style="color: #1e293b; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Launch Your Demo</h1>
                    </div>
                    
                    <p style="font-size: 17px; line-height: 1.6; color: #475569; margin-bottom: 32px; text-align: center;">
                        Hi ${userName || 'there'}, we're excited to show you the future of healthcare! <br/> 
                        Enter the code below in your demo window to verify your email and get started.
                    </p>
                    
                    <div style="background-color: #f1f5f9; border-radius: 20px; padding: 32px 10px; text-align: center; margin: 32px 0; border: 1px solid #e2e8f0;">
                        <div style="font-family: 'SF Mono', Consolas, monospace; font-size: 38px; font-weight: 800; color: #2563eb; letter-spacing: 0.15em; display: inline-block; white-space: nowrap; margin-bottom: 8px;">
                            ${code}
                        </div>
                        <p style="font-size: 12px; color: #64748b; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                            Valid for 45 minutes
                        </p>
                    </div>
                    
                    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-top: 32px; text-align: center; font-style: italic;">
                        If you didn't request a demo, you can safely ignore this email.
                    </p>

                    <div style="border-top: 1px solid #f1f5f9; margin-top: 48px; padding-top: 32px; text-align: center;">
                        <p style="font-size: 13px; color: #94a3b8; margin: 0; font-weight: 500;">
                            © ${new Date().getFullYear()} PageMD EMR • HIPAA Compliant Sandbox
                        </p>
                    </div>
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
        const subject = `Your PageMD Demo Access Link`;
        const html = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; padding: 40px 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 12px 20px; border-radius: 12px; margin-bottom: 20px;">
                            <span style="color: white; font-weight: 700; font-size: 22px; letter-spacing: -0.5px;">PageMD</span>
                        </div>
                        <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Welcome, ${userName || 'Doctor'}!</h1>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 20px;">
                        Thank you for your interest in PageMD. Click the button below to launch your personal sandbox demo environment.
                    </p>
                    
                    <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 30px;">
                        Your demo will be pre-populated with sample patients, visits, and clinical data so you can experience the full power of PageMD instantly.
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4);">
                            Launch My Demo →
                        </a>
                    </div>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                        <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 500;">
                            ⏱️ This link expires in 45 minutes for security purposes.
                        </p>
                    </div>
                    
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 30px;">
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
