import stripe

from app.config import get_settings
from app.services.plans import get_plan


class StripeService:
    @staticmethod
    def _get_client() -> stripe.StripeClient:
        settings = get_settings()
        return stripe.StripeClient(api_key=settings.stripe_secret_key)

    @staticmethod
    async def create_checkout_session(
        org_id: str,
        plan: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        """Create a Stripe checkout session and return the session URL.

        Falls back to a mock URL when stripe_secret_key is not configured.
        """
        settings = get_settings()

        if not settings.stripe_secret_key:
            # Mock mode: return a fake checkout URL for local development
            return (
                f"{settings.public_web_url}/dashboard/billing"
                f"?mock_checkout=true&plan={plan}&org_id={org_id}"
            )

        plan_config = get_plan(plan)
        if plan_config is None:
            raise ValueError(f"Unknown plan: {plan}")

        try:
            session = stripe.checkout.Session.create(
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
                            "unit_amount": plan_config["price_cents"],
                            "recurring": {"interval": "month"},
                            "product_data": {"name": plan_config["name"]},
                        },
                        "quantity": 1,
                    }
                ],
                metadata={"org_id": org_id, "plan": plan},
                api_key=settings.stripe_secret_key,
            )
            return session.url or ""
        except stripe.StripeError as exc:
            raise RuntimeError(f"Stripe checkout session creation failed: {exc}") from exc

    @staticmethod
    async def create_customer_portal_session(
        stripe_customer_id: str,
        return_url: str,
    ) -> str:
        """Create a Stripe billing portal session and return its URL."""
        settings = get_settings()

        if not settings.stripe_secret_key:
            return f"{settings.public_web_url}/dashboard/billing?mock_portal=true"

        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=return_url,
                api_key=settings.stripe_secret_key,
            )
            return session.url
        except stripe.StripeError as exc:
            raise RuntimeError(f"Stripe portal session creation failed: {exc}") from exc

    @staticmethod
    async def cancel_subscription(stripe_subscription_id: str) -> None:
        """Cancel a Stripe subscription at the end of the current billing period."""
        settings = get_settings()

        if not settings.stripe_secret_key:
            return  # mock mode — nothing to do

        try:
            stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=True,
                api_key=settings.stripe_secret_key,
            )
        except stripe.StripeError as exc:
            raise RuntimeError(f"Stripe subscription cancellation failed: {exc}") from exc

    @staticmethod
    async def handle_webhook(payload: bytes, sig_header: str) -> dict:
        """Verify Stripe webhook signature and return the parsed event."""
        settings = get_settings()

        if not settings.stripe_webhook_secret:
            # Mock mode: parse payload without signature verification
            import json
            return json.loads(payload)

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
            return dict(event)
        except stripe.errors.SignatureVerificationError as exc:
            raise ValueError(f"Invalid Stripe webhook signature: {exc}") from exc
        except Exception as exc:
            raise ValueError(f"Webhook payload parsing failed: {exc}") from exc
