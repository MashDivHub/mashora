"""
CRM Lead / Opportunity model.

Maps to existing PostgreSQL table: crm_lead
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class CrmLead(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """
    Maps to crm_lead table.

    Represents both leads (unqualified) and opportunities (qualified)
    in the CRM pipeline. The type field distinguishes them.
    """

    __tablename__ = "crm_lead"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # lead / opportunity
    priority: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    stage_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_stage.id", ondelete="SET NULL"), nullable=True
    )
    kanban_state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    team_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_team.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    partner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    expected_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    prorated_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    recurring_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    probability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    automated_probability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    date_open: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_closed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_last_stage_update: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_conversion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    lost_reason_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_lost_reason.id", ondelete="SET NULL"), nullable=True
    )
    referred: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    zip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_country_state.id", ondelete="SET NULL"), nullable=True
    )
    country_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_country.id", ondelete="SET NULL"), nullable=True
    )
    lang_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_lang.id", ondelete="SET NULL"), nullable=True
    )
    campaign_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("utm_campaign.id", ondelete="SET NULL"), nullable=True
    )
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("utm_source.id", ondelete="SET NULL"), nullable=True
    )
    medium_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("utm_medium.id", ondelete="SET NULL"), nullable=True
    )
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    stage: Mapped[Optional["CrmStage"]] = relationship(  # type: ignore[name-defined]
        "CrmStage", foreign_keys=[stage_id]
    )
    team: Mapped[Optional["CrmTeam"]] = relationship(  # type: ignore[name-defined]
        "CrmTeam", foreign_keys=[team_id]
    )
    lost_reason: Mapped[Optional["CrmLostReason"]] = relationship(  # type: ignore[name-defined]
        "CrmLostReason", foreign_keys=[lost_reason_id]
    )

    def __repr__(self) -> str:
        return (
            f"<CrmLead id={self.id} name={self.name!r} "
            f"type={self.type!r} stage_id={self.stage_id}>"
        )
