"""Email configuration and sending endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import get_current_user, CurrentUser
from app.services.email_service import send_email, send_notification_email
from app.services.base import async_search_read

router = APIRouter(prefix="/email", tags=["email"])


class SendEmailRequest(BaseModel):
    to: list[str]
    subject: str
    body_html: str
    body_text: Optional[str] = None
    cc: Optional[list[str]] = None


class TestEmailRequest(BaseModel):
    to: str


@router.post("/send")
async def send(body: SendEmailRequest, user: CurrentUser = Depends(get_current_user)):
    """Send an email (requires authentication)."""
    success = await send_email(
        to=body.to,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        cc=body.cc,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email")
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
