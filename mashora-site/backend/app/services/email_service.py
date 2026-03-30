import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

template_dir = Path(__file__).parent.parent / "templates" / "email"
env = Environment(loader=FileSystemLoader(str(template_dir)), autoescape=True)


class EmailService:
    @staticmethod
    async def send_welcome(email: str, org_name: str) -> None:
        html = EmailService._render_template("welcome.html", org_name=org_name)
        EmailService._send(email, f"Welcome to Mashora, {org_name}!", html)

    @staticmethod
    async def send_invoice(
        email: str,
        org_name: str,
        amount_cents: int,
        currency: str,
        invoice_url: str | None = None,
    ) -> None:
        amount_formatted = f"{amount_cents / 100:.2f}"
        html = EmailService._render_template(
            "invoice.html",
            org_name=org_name,
            amount_formatted=amount_formatted,
            currency=currency.upper(),
            invoice_url=invoice_url,
        )
        EmailService._send(email, f"Your Mashora Invoice – {currency.upper()} {amount_formatted}", html)

    @staticmethod
    async def send_payment_failed(email: str, org_name: str, retry_date: str) -> None:
        html = EmailService._render_template(
            "payment_failed.html",
            org_name=org_name,
            retry_date=retry_date,
        )
        EmailService._send(email, "Action Required: Payment Failed – Mashora", html)

    @staticmethod
    async def send_suspension_warning(email: str, org_name: str, days_remaining: int) -> None:
        html = EmailService._render_template(
            "suspension_warning.html",
            org_name=org_name,
            days_remaining=days_remaining,
        )
        EmailService._send(
            email,
            f"Your Mashora account will be suspended in {days_remaining} day(s)",
            html,
        )

    @staticmethod
    async def send_suspended(email: str, org_name: str) -> None:
        html = EmailService._render_template("suspended.html", org_name=org_name)
        EmailService._send(email, "Your Mashora Account Has Been Suspended", html)

    @staticmethod
    def _render_template(template_name: str, **kwargs) -> str:
        template = env.get_template(template_name)
        return template.render(**kwargs)

    @staticmethod
    def _send(to: str, subject: str, html_body: str) -> None:
        # For now, just log. Real SMTP integration is future work.
        logger.info(f"EMAIL TO: {to} | SUBJECT: {subject}")
        logger.debug(f"BODY: {html_body[:200]}...")
