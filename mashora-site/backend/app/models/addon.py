import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Addon(Base):
    __tablename__ = "addons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    technical_name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    version = Column(String(20), nullable=True)
    mashora_version_min = Column(String(20), nullable=False, default="19.0")
    price_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    icon_url = Column(Text, nullable=True)
    download_count = Column(Integer, nullable=False, default=0)
    rating_avg = Column(Numeric(3, 2), nullable=False, default=0)
    rating_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = relationship("Organization", backref="addons")
    versions = relationship("AddonVersion", back_populates="addon", cascade="all, delete-orphan")
    reviews = relationship("AddonReview", back_populates="addon", cascade="all, delete-orphan")
