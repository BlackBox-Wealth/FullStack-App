import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings
import logging

log = logging.getLogger("sim_email")


async def send_simulation_email(
    to_address: str,
    subject: str,
    html_body: str,
    from_name: str,
    from_address: str,
) -> tuple[bool, Optional[str]]:
    """Send a simulation email. Returns (success, message_id)."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_address}>"
        msg["To"] = to_address
        msg["X-Mailer"] = "PSB Internal Mail v2.4"
        msg.attach(MIMEText(html_body, "html"))

        host = getattr(settings, "SIMULATION_SMTP_HOST", settings.MAIL_SERVER or "localhost")
        port = int(getattr(settings, "SIMULATION_SMTP_PORT", settings.MAIL_PORT or 1025))
        username = getattr(settings, "SMTP_USERNAME", settings.NO_REPLY_EMAIL or "")
        password = getattr(settings, "SMTP_PASSWORD", settings.MAIL_PASSWORD or "")

        if port == 465:
            server = smtplib.SMTP_SSL(host, port)
        else:
            server = smtplib.SMTP(host, port)
            if username:
                server.starttls()

        if username and password:
            server.login(username, password)

        # Gmail requires MAIL FROM (envelope) to match the authenticated account.
        # The From header in the message still shows the spoofed display address.
        mail_from = username if username else from_address
        server.sendmail(mail_from, [to_address], msg.as_string())
        server.quit()
        message_id = msg.get("Message-ID", f"<sim-{id(msg)}@psb-internal.in>")
        return True, message_id
    except Exception as e:
        log.warning(f"Email delivery failed to {to_address}: {e}")
        return False, None


async def send_report_email(
    to_address: str,
    html_body: str,
    simulation_date: str,
) -> tuple[bool, Optional[str]]:
    subject = f"PSB Security Awareness — Simulation Analysis Report ({simulation_date})"
    return await send_simulation_email(
        to_address=to_address,
        subject=subject,
        html_body=html_body,
        from_name="PSB Security Team",
        from_address="security@psb-internal.in",
    )
