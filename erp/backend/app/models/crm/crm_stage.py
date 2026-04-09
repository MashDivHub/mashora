"""
CRM Stage model.

Maps to existing PostgreSQL table: crm_stage
"""
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CrmStage(Base, TimestampMixin):
    """
    Maps to crm_stage table.

    Represents a stage in the CRM pipeline (e.g. New, Qualified, Won).
    Stages can be shared across teams or be team-specific.
    """

    __tablename__ = "crm_stage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    probability: Mapped[Optional[float]] = mapped_column(nullable=True)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    requirements: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    team_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_team.id", ondelete="SET NULL"), nullable=True
    )
    legend_blocked: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    legend_done: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    legend_normal: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    fold: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Relationships
    team: Mapped[Optional["CrmTeam"]] = relationship(  # type: ignore[name-defined]
        "CrmTeam", foreign_keys=[team_id]
    )

    def __repr__(self) -> str:
        return f"<CrmStage id={self.id} sequence={self.sequence} is_won={self.is_won}>"
