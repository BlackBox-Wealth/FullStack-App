import time
import traceback
from app.core.config import settings
from logifyx import Logifyx
from email.message import EmailMessage
from email.utils import formatdate
import aiosmtplib
import traceback

log = Logifyx(name="email_service")

# Define the scope for Gmail API
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

class EmailService:

    async def send_email(self, to_email: str, subject: str, body_html: str, retries=3, delay=5):
        """Send an email using Gmail API with retry mechanism."""

        # Wrap body in premium HTML template
        final_html = self._get_base_template(subject, body_html)

        for attempt in range(retries):
            try:
                message = EmailMessage()
                message["From"] = settings.NO_REPLY_EMAIL
                message["To"] = to_email
                message["Subject"] = subject
                message["Date"] = formatdate(localtime=True)
                
                # HTML body
                message.set_content("This email requires an HTML-capable client.")
                message.add_alternative(final_html, subtype="html")

                await aiosmtplib.send(
                    message,
                    hostname=settings.MAIL_SERVER,
                    port=settings.MAIL_PORT,
                    username=settings.NO_REPLY_EMAIL,
                    password=settings.MAIL_PASSWORD,
                    use_tls=True,
                    timeout=30
                )

                log.info(f"✅ Email sent to {to_email} (Subject: {subject})")
                return True
            
            except aiosmtplib.errors.SMTPAuthenticationError as e:
                log.warning(f"Gmail authentication failed: {e}")
                log.warning("Please check:")
                log.warning("1. Enable 2-Factor Authentication on Gmail")
                log.warning("2. Generate App Password (not regular password)")
                log.warning("3. Use the 16-character App Password in MAIL_PASSWORD")
                raise
        
            except Exception as exc:
                log.error(f"Failed to send email to {to_email} (Attempt {attempt + 1}/{retries}): {exc}")
                log.error(traceback.format_exc())
                if attempt < retries - 1:
                    log.info(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    log.error(f"All retry attempts failed for email to {to_email}.")
                    return False

    def _get_base_template(self, title, content_html):
        """Premium HTML Email Template Architecture"""
        return f"""
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>{title}</title>
                        <style>
                            body {{
                                margin: 0;
                                padding: 0;
                                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                                background-color: #f8fafc;
                                color: #1e293b;
                            }}
                            .wrapper {{
                                width: 100%;
                                table-layout: fixed;
                                background-color: #f8fafc;
                                padding-bottom: 40px;
                            }}
                            .main {{
                                background-color: #ffffff;
                                margin: 0 auto;
                                width: 100%;
                                max-width: 600px;
                                border-spacing: 0;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                            }}
                            .header {{
                                background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                                padding: 32px;
                                text-align: center;
                            }}
                            .header h1 {{
                                color: #ffffff;
                                margin: 0;
                                font-size: 28px;
                                font-weight: 700;
                                letter-spacing: -0.025em;
                            }}
                            .content {{
                                padding: 40px;
                                line-height: 1.6;
                            }}
                            .content h2 {{
                                color: #0f172a;
                                font-size: 20px;
                                margin-top: 0;
                                margin-bottom: 20px;
                            }}
                            .button {{
                                display: inline-block;
                                padding: 14px 28px;
                                background-color: #2563eb;
                                color: #ffffff !important;
                                text-decoration: none;
                                border-radius: 8px;
                                font-weight: 600;
                                margin: 24px 0;
                                text-align: center;
                            }}
                            .footer {{
                                text-align: center;
                                padding: 32px;
                                color: #64748b;
                                font-size: 14px;
                            }}
                            .highlight {{
                                color: #2563eb;
                                font-weight: 600;
                            }}
                            .alert {{
                                background-color: #fff1f2;
                                border-left: 4px solid #e11d48;
                                padding: 16px;
                                margin: 20px 0;
                                border-radius: 4px;
                            }}
                        </style>
                    </head>
                    <body>
                        <div class="wrapper">
                            <table class="main">
                                <tr>
                                    <td class="header">
                                        <h1>WealthVault</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="content">
                                        {content_html}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="footer">
                                        <p>&copy; 2026WealthVault. All rights reserved.</p>
                                        <p>Securing your wealth, powering your future.</p>
                                        <p style="font-size: 12px; margin-top: 20px;">You are receiving this email because of activity on your WealthVault account.</p>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </body>
                    </html>
                            """

    async def send_welcome_email(self, to_email: str, full_name: str):
        subject = f"Welcome to WealthVault, {full_name}!"
        body = f"""
                    <h2>Welcome to the future of wealth management.</h2>
                    <p>Hi <span class="highlight">{full_name}</span>,</p>
                    <p>We're thrilled to have you at <strong>WealthVault</strong>. You've just taken a significant step toward smarter, AI-driven financial growth.</p>
                    <p>Explore your dashboard, set up your portfolios, and let our ML models provide you with premium insights.</p>
                    <div style="text-align: center;">
                        <a href="{settings.FRONTEND_URL}" class="button">Access Your Vault</a>
                    </div>
                    <p>If you need any help, our dedicated relationship managers are standing by.</p>
                """
        return await self.send_email(to_email, subject, body)

    async def send_verification_email(self, to_email: str, otp: str):
        subject = "Action Required: Verify Your Identity"
        body = f"""
                    <h2>Identity Verification</h2>
                    <p>Please use the following single-use code to verify your action on WealthVault. This code helps us keep your account and assets secure.</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <span style="font-family: monospace; font-size: 42px; font-weight: 700; letter-spacing: 8px; background-color: #f1f5f9; padding: 12px 24px; border-radius: 8px; color: #1e3a8a;">{otp}</span>
                    </div>
                    <p>This code will expire in {settings.OTP_EXPIRE_SECONDS // 60} minutes.</p>
                    <p style="font-size: 14px; color: #64748b;">If you did not request this code, please change your password immediately and contact support.</p>
                """
        return await self.send_email(to_email, subject, body)

    async def send_transaction_alert(self, to_email: str, amount: float, account_num: str, type: str, status: str):
        subject = f"Transaction Alert: {type.title()} on Account ...{account_num[-4:]}"
        color = "#059669" if type.lower() == "credit" else "#e11d48"
        body = f"""
                    <h2>Transaction Notification</h2>
                    <p>A new transaction has been recorded on your account.</p>
                    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Type:</strong> {type.title()}</p>
                        <p style="margin: 8px 0;"><strong>Amount:</strong> <span style="color: {color}; font-size: 18px; font-weight: 700;">₹{amount:,.2f}</span></p>
                        <p style="margin: 8px 0;"><strong>Account:</strong> WealthVault (...{account_num[-4:]})</p>
                        <p style="margin: 8px 0;"><strong>Status:</strong> {status.upper()}</p>
                        <p style="margin: 8px 0;"><strong>Date:</strong> {time.strftime("%d %b %Y, %H:%M %Z")}</p>
                    </div>
                    <p>If you suspect unauthorized activity, please freeze your account immediately through the mobile app or web portal.</p>
                """
        return await self.send_email(to_email, subject, body)

    async def send_security_alert(self, to_email: str, device: str, location: str):
        subject = "Security Alert: New Device Login"
        body = f"""
                    <div class="alert">
                        <h2 style="color: #e11d48; margin: 0;">Security Alert</h2>
                    </div>
                    <p>A new login was detected on your WealthVault account from an unrecognized device or location.</p>
                    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Device:</strong> {device}</p>
                        <p style="margin: 8px 0;"><strong>Location:</strong> {location}</p>
                        <p style="margin: 8px 0;"><strong>Time:</strong> {time.strftime("%d %b %Y, %H:%M %Z")}</p>
                    </div>
                    <p><strong>Is this you?</strong> If yes, you can ignore this email. We've registered this device to your profile.</p>
                    <p><strong>Not you?</strong> Your account security may be compromised. Please click the button below to secure your account immediately.</p>
                    <div style="text-align: center;">
                        <a href="{settings.FRONTEND_URL}/security/reset" class="button" style="background-color: #e11d48;">Secure My Account</a>
                    </div>
                """
        return await self.send_email(to_email, subject, body)

    async def send_new_device_alert(
        self,
        to_email: str,
        full_name: str,
        browser: str,
        os_info: str,
        device_type: str,
        location: str,
        ip_address: str,
        login_time: str,
    ):
        """Send a rich security alert email when a new device or new location is detected."""
        subject = "⚠️ New Device Login Detected - WealthVault"
        device_icon = "📱" if device_type == "mobile" else ("💻" if device_type == "tablet" else "🖥️")
        body = f"""
                    <div class="alert">
                        <h2 style="color: #e11d48; margin: 0;">🔐 New Login Detected</h2>
                    </div>
                    <p>Hi <span class="highlight">{full_name}</span>,</p>
                    <p>We detected a login to your <strong>WealthVault</strong> account from a device or location we haven't seen before. Here are the details:</p>

                    <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #e11d48;">
                        <p style="margin: 10px 0;"><strong>{device_icon} Device Type:</strong> {device_type.title()}</p>
                        <p style="margin: 10px 0;"><strong>🌐 Browser:</strong> {browser}</p>
                        <p style="margin: 10px 0;"><strong>💽 Operating System:</strong> {os_info}</p>
                        <p style="margin: 10px 0;"><strong>📍 Location:</strong> {location}</p>
                        <p style="margin: 10px 0;"><strong>🌍 IP Address:</strong> {ip_address}</p>
                        <p style="margin: 10px 0;"><strong>🕐 Time:</strong> {login_time}</p>
                    </div>

                    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 20px 0;">
                        <p style="margin: 0; color: #15803d; font-weight: 600;">✅ Was this you?</p>
                        <p style="margin: 8px 0 0 0; color: #166534;">If you recognize this login, you can safely ignore this email. This device has been registered to your account.</p>
                    </div>

                    <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 16px; border-radius: 4px; margin: 20px 0;">
                        <p style="margin: 0; color: #e11d48; font-weight: 600;">🚨 Wasn't you?</p>
                        <p style="margin: 8px 0 0 0; color: #9f1239;">Your account may be compromised. Please take immediate action to protect your account and assets.</p>
                    </div>

                    <div style="text-align: center; margin: 32px 0;">
                        <a href="{settings.FRONTEND_URL}/security/alert" class="button" style="background-color: #e11d48; font-size: 16px; padding: 16px 36px;">
                            🔒 This Wasn't Me — Secure My Account
                        </a>
                    </div>

                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 24px; text-align: center;">
                        <p style="margin: 0; font-weight: 600; color: #0f172a;">Need immediate help?</p>
                        <p style="margin: 8px 0 0 0; color: #475569;">Contact our 24/7 Security Team:</p>
                        <p style="margin: 8px 0 0 0; font-size: 18px;"><strong>📞 1800-XXX-XXXX</strong> (Toll Free)</p>
                        <p style="margin: 4px 0 0 0; color: #475569;"><strong>📧 security@wealthvault.com</strong></p>
                    </div>

                    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">This is an automated security notification. WealthVault will never ask for your password or OTP via email.</p>
                """
        return await self.send_email(to_email, subject, body)

    async def send_notification(self, to_email: str, title: str, message: str, action_url: str = None):
        subject = f"Notification: {title}"
        body = f"""
            <h2>{title}</h2>
            <p>{message}</p>
            {f'<div style="text-align: center;"><a href="{action_url}" class="button">View Details</a></div>' if action_url else ''}
        """
        return await self.send_email(to_email, subject, body)

    async def send_fraud_alert(self, to_email: str, amount: float, recipient: str, risk_score: float, risk_factors: list):
        """Send fraud/high-risk payment alert email."""
        subject = "⚠️ High-Risk Payment Alert - WealthVault"
        risk_level = "HIGH" if risk_score > 0.7 else "MEDIUM"
        risk_color = "#e11d48" if risk_score > 0.7 else "#f59e0b"
        
        factors_html = "<ul>" + "".join([f"<li>{factor}</li>" for factor in risk_factors]) + "</ul>"
        
        body = f"""
                    <div class="alert">
                        <h2 style="color: {risk_color}; margin: 0;">⚠️ Security Alert: Suspicious Payment Detected</h2>
                    </div>
                    <p>We detected a <strong style="color: {risk_color};">{risk_level} RISK</strong> payment from your account:</p>
                    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {risk_color};">
                        <p style="margin: 8px 0;"><strong>Amount:</strong> <span style="color: {risk_color}; font-size: 20px; font-weight: 700;">₹{amount:,.2f}</span></p>
                        <p style="margin: 8px 0;"><strong>Recipient Account:</strong> •••• {recipient}</p>
                        <p style="margin: 8px 0;"><strong>Risk Score:</strong> <span style="color: {risk_color}; font-weight: 700;">{risk_score:.0%}</span></p>
                        <p style="margin: 8px 0;"><strong>Risk Level:</strong> <span style="color: {risk_color}; font-weight: 700;">{risk_level}</span></p>
                    </div>
                    <h3 style="color: #0f172a; margin-top: 24px;">Why was this flagged?</h3>
                    {factors_html}
                    <div style="background-color: #fff1f2; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #e11d48;">
                        <p style="margin: 0; font-weight: 600; color: #e11d48;">⚠️ If you did NOT authorize this payment:</p>
                        <p style="margin: 8px 0 0 0;">Contact our security team immediately at <strong>security@wealthvault.com</strong> or call <strong>1800-XXX-XXXX</strong></p>
                    </div>
                    <p style="font-size: 14px; color: #64748b; margin-top: 24px;">This is an automated security alert. We monitor all transactions to protect your account.</p>
                """
        return await self.send_email(to_email, subject, body)

email_service = EmailService()
