import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AddonReview(Base):
    __tablename__ = "addon_reviews"

    __table_args__ = (
        UniqueConstraint("addon_id", "user_id", name="uq_addon_review_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    addon_id = Column(UUID(as_uuid=True), ForeignKey("addons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    addon = relationship("Addon", back_populates="reviews")
    user = relationship("User", backref="addon_reviews")
