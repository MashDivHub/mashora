"""
CRM Lost Reason model.

Maps to existing PostgreSQL table: crm_lost_reason
"""
from typing import Optional

from sqlalchemy import Integer, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, ActiveMixin


class CrmLostReason(Base, TimestampMixin, ActiveMixin):
    """
    Maps to crm_lost_reason table.

    Stores the configurable reasons used when marking an opportunity as lost.
    """

    __tablename__ = "crm_lost_reason"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<CrmLostReason id={self.id}>"
