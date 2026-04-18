"""Email configuration and sending endpoints."""
import base64
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import get_current_user, CurrentUser
from app.services.email_service import send_email, send_notification_email
from app.services.base import async_search_read, async_get, async_create

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email"])


class SendEmailRequest(BaseModel):
    to: list[str]
    subject: str
    body_html: str
    body_text: Optional[str] = None
    cc: Optional[list[str]] = None
    bcc: Optional[list[str]] = None
    # Optional record context
    model: Optional[str] = None
    res_id: Optional[int] = None
    # ir.attachment IDs to include
    attachment_ids: Optional[list[int]] = None


class TestEmailRequest(BaseModel):
    to: str


@router.post("/send")
async def send(body: SendEmailRequest, user: CurrentUser = Depends(get_current_user)):
    """Send an email (requires authentication).

    Supports CC, BCC, optional resource context (model, res_id) for logging,
    and attachment_ids referencing pre-uploaded ir.attachment records.
    """
    # Resolve attachments — best-effort; failures don't block the send.
    attachments: list[tuple[str, bytes, str]] = []
    if body.attachment_ids:
        for att_id in body.attachment_ids:
            try:
                rec = await async_get(
                    "ir.attachment", att_id,
                    fields=["name", "datas", "mimetype"],
                )
                if rec and rec.get("datas"):
                    attachments.append((
                        rec.get("name") or f"attachment_{att_id}",
                        base64.b64decode(rec["datas"]),
                        rec.get("mimetype") or "application/octet-stream",
                    ))
            except Exception:
                _logger.exception("Failed to load attachment %s", att_id)

    success = await send_email(
        to=body.to,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        cc=body.cc,
        bcc=body.bcc,
        attachments=attachments or None,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email")

    # Re-link attachments to the target record so they appear in the chatter.
    if body.model and body.res_id and body.attachment_ids:
        for att_id in body.attachment_ids:
            try:
                from app.services.base import async_update
                await async_update(
                    "ir.attachment", att_id,
                    {"res_model": body.model, "res_id": body.res_id},
                    uid=user.uid if user else 1,
                )
            except Exception:
                pass

    return {"status": "sent"}


@router.post("/test")
async def test_email(body: TestEmailRequest, user: CurrentUser = Depends(get_current_user)):
    """Send a test email to verify configuration."""
    success = await send_notification_email(
        to=body.to,
        subject="Mashora ERP — Test Email",
        message="This is a test email from your Mashora ERP instance. If you received this, your email configuration is working correctly.",
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP configuration.")
    return {"status": "sent", "to": body.to}


@router.get("/servers")
async def list_mail_servers(user: CurrentUser = Depends(get_current_user)):
    """List configured mail servers."""
    result = await async_search_read("ir.mail.server", domain=[], limit=50, order="sequence asc")
    return result
