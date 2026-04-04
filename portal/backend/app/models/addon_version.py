import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AddonVersion(Base):
    __tablename__ = "addon_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    addon_id = Column(UUID(as_uuid=True), ForeignKey("addons.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(20), nullable=False)
    changelog = Column(Text, nullable=True)
    file_path = Column(Text, nullable=False)
    file_hash = Column(String(64), nullable=False)
    file_size = Column(Integer, nullable=True)
    mashora_version_compat = Column(String(20), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)

    addon = relationship("Addon", back_populates="versions")
