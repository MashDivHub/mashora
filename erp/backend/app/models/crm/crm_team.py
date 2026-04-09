"""
CRM Team (Sales Team) model.

Maps to existing PostgreSQL table: crm_team
"""
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class CrmTeam(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """
    Maps to crm_team table.

    Represents a sales / CRM team. Leads and opportunities are assigned
    to a team, and team members are tracked via a many-to-many relation.
    """

    __tablename__ = "crm_team"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    alias_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mail_alias.id", ondelete="SET NULL"), nullable=True
    )
    use_leads: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    use_opportunities: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    assignment_domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    assignment_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    crm_team_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Relationships
    team_lead: Mapped[Optional["ResUsers"]] = relationship(  # type: ignore[name-defined]
        "ResUsers", foreign_keys=[user_id]
    )

    def __repr__(self) -> str:
        return f"<CrmTeam id={self.id}>"
