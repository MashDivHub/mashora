"""Account Journal model."""
from typing import Optional
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountJournal(Base, TimestampMixin):
    __tablename__ = "account_journal"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    default_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suspense_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    profit_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    loss_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bank_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    code: Mapped[str] = mapped_column(String(5), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    invoice_reference_type: Mapped[str] = mapped_column(String, nullable=False)
    invoice_reference_model: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    show_on_dashboard: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    def __repr__(self): return f"<AccountJournal(id={self.id}, code={self.code}, type={self.type})>"
