"""Account Fiscal Position model."""
from typing import Optional
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountFiscalPosition(Base, TimestampMixin):
    __tablename__ = "account_fiscal_position"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    country_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country_group_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    note: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    auto_apply: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    vat_required: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
