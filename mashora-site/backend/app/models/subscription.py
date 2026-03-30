import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    license_id = Column(UUID(as_uuid=True), ForeignKey("licenses.id", ondelete="SET NULL"), nullable=True, index=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    plan = Column(String(50), nullable=False)
    amount_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="usd")
    interval = Column(String(20), nullable=False, default="month")
    status = Column(String(50), nullable=False, default="active")
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="subscriptions")
    license = relationship("License", back_populates="subscriptions")
