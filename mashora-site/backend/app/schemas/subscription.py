from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubscriptionCreate(BaseModel):
    plan: str  # starter, professional, enterprise
    success_url: str = "http://localhost:3000/dashboard/billing?success=true"
    cancel_url: str = "http://localhost:3000/dashboard/billing?cancelled=true"


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
