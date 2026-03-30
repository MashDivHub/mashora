import asyncio

from app.tasks import celery_app


@celery_app.task
def send_welcome_email(email: str, org_name: str) -> None:
    from app.services.email_service import EmailService
    asyncio.run(EmailService.send_welcome(email, org_name))


@celery_app.task
def send_invoice_email(
    email: str,
    org_name: str,
    amount_cents: int,
    currency: str,
    invoice_url: str | None = None,
) -> None:
    from app.services.email_service import EmailService
    asyncio.run(EmailService.send_invoice(email, org_name, amount_cents, currency, invoice_url))


@celery_app.task
def send_payment_failed_email(email: str, org_name: str, retry_date: str) -> None:
    from app.services.email_service import EmailService
    asyncio.run(EmailService.send_payment_failed(email, org_name, retry_date))


@celery_app.task
def send_suspension_warning_email(email: str, org_name: str, days_remaining: int) -> None:
    from app.services.email_service import EmailService
    asyncio.run(EmailService.send_suspension_warning(email, org_name, days_remaining))


@celery_app.task
def send_suspended_email(email: str, org_name: str) -> None:
    from app.services.email_service import EmailService
    asyncio.run(EmailService.send_suspended(email, org_name))
