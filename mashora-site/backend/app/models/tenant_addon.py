from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TenantAddon(Base):
    __tablename__ = "tenant_addons"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    addon_id = Column(UUID(as_uuid=True), ForeignKey("addons.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    addon_version_id = Column(UUID(as_uuid=True), ForeignKey("addon_versions.id", ondelete="SET NULL"), nullable=True)
    installed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
