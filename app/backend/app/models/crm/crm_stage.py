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
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    requirements: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    rotting_threshold_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fold: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    def __repr__(self) -> str:
        return f"<CrmStage id={self.id} sequence={self.sequence} is_won={self.is_won}>"
