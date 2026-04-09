"""
Async email sending service for Mashora ERP.
Uses aiosmtplib for non-blocking email delivery.
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
from app.config import get_settings

_logger = logging.getLogger(__name__)


async def send_email(
    to: str | list[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """Send an email via SMTP. Returns True on success."""
    settings = get_settings()

    sender_email = from_email or settings.smtp_from_email
    sender_name = from_name or settings.smtp_from_name
    sender = f"{sender_name} <{sender_email}>" if sender_name else sender_email

    if isinstance(to, str):
        to = [to]

    msg = MIMEMultipart("alternative")
    msg["From"] = sender
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to:
        msg["Reply-To"] = reply_to

    # Attach text and HTML parts
    if body_text:
        msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    recipients = list(to)
    if cc:
        recipients.extend(cc)
    if bcc:
        recipients.extend(bcc)

    try:
        use_tls = settings.smtp_use_tls and not settings.smtp_use_ssl

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_use_ssl,
            start_tls=use_tls,
            recipients=recipients,
        )
        _logger.info("Email sent to %s: %s", ", ".join(to), subject)
        return True
    except Exception:
        _logger.exception("Failed to send email to %s: %s", ", ".join(to), subject)
        return False


async def send_notification_email(
    to: str,
    subject: str,
    message: str,
    action_url: Optional[str] = None,
) -> bool:
    """Send a notification email with standard Mashora template."""
    body_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #18181b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Mashora ERP</h2>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e4e4e7; border-top: none;">
        <h3 style="margin: 0 0 16px; color: #18181b;">{subject}</h3>
        <p style="color: #3f3f46; line-height: 1.6;">{message}</p>
        {"<p style='margin-top: 24px;'><a href='" + action_url + "' style='background: #18181b; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; display: inline-block;'>View in Mashora</a></p>" if action_url else ""}
      </div>
      <div style="padding: 16px 32px; text-align: center; color: #a1a1aa; font-size: 12px;">
        Sent by Mashora ERP
      </div>
    </div>
    """
    return await send_email(to=to, subject=subject, body_html=body_html)
