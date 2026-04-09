"""Account Tax and Tax Group models."""
from typing import Optional
from sqlalchemy import Boolean, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountTax(Base, TimestampMixin):
    __tablename__ = "account_tax"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    cash_basis_transition_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country_id: Mapped[int] = mapped_column(Integer, nullable=False)
    type_tax_use: Mapped[str] = mapped_column(String, nullable=False)
    tax_scope: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount_type: Mapped[str] = mapped_column(String, nullable=False)
    price_include_override: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tax_exigibility: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_label: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    invoice_legal_notes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    is_domestic: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    include_base_amount: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_base_affected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    analytic: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    def __repr__(self): return f"<AccountTax(id={self.id}, amount={self.amount})>"

class AccountTaxGroup(Base, TimestampMixin):
    __tablename__ = "account_tax_group"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_payable_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tax_receivable_account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    preceding_subtotal: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    def __repr__(self): return f"<AccountTaxGroup(id={self.id})>"
