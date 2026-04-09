"""
ResUsers model.
Maps to: res_users
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class ResUsers(TimestampMixin, ActiveMixin, Base):
    """ERP user account (res_users)."""

    __tablename__ = "res_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Core
    login: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    share: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    tour_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    notification_type: Mapped[str] = mapped_column(String, nullable=False)
    signature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 2FA
    totp_secret: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    totp_last_counter: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Presence / IM
    manual_im_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    out_of_office_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    out_of_office_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    out_of_office_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Bot
    mashorabot_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mashorabot_failed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # JSONB
    property_warehouse_id: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Foreign keys
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_company.id", ondelete="RESTRICT"), nullable=False
    )
    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="RESTRICT"), nullable=False
    )
    action_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sale_team_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    website_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    partner: Mapped["ResPartner"] = relationship(
        "ResPartner", foreign_keys=[partner_id]
    )
    company: Mapped["ResCompany"] = relationship(
        "ResCompany", foreign_keys=[company_id]
    )

    def __repr__(self) -> str:
        return f"<ResUsers id={self.id} login={self.login!r}>"


# Avoid circular import — import strings used in relationship() are resolved lazily
from app.models.base.res_partner import ResPartner  # noqa: E402, F401
from app.models.base.res_company import ResCompany  # noqa: E402, F401
