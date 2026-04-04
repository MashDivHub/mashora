from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.config import get_settings


def default_success_url() -> str:
    return f"{get_settings().public_web_url}/dashboard/billing?success=true"


def default_cancel_url() -> str:
    return f"{get_settings().public_web_url}/dashboard/billing?cancelled=true"


class SubscriptionCreate(BaseModel):
    plan: str  # starter, professional, enterprise
    success_url: str = Field(default_factory=default_success_url)
    cancel_url: str = Field(default_factory=default_cancel_url)


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    plan: str
    amount_cents: int
    currency: str
    interval: str
    status: str
    stripe_subscription_id: str | None
    current_period_start: datetime | None
    current_period_end: datetime | None


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class PlanInfo(BaseModel):
    name: str
    slug: str
    price_cents: int
    max_users: int
    max_apps: int
    features: dict
