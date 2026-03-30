import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    db_name = Column(String(100), unique=True, nullable=False)
    db_host = Column(String(255), nullable=False)
    db_port = Column(Integer, nullable=False, default=5432)
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="active")
    mashora_version = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization", back_populates="tenants")
