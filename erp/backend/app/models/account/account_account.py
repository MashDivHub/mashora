"""Chart of Accounts model."""
from typing import Optional
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AccountAccount(Base, TimestampMixin):
    __tablename__ = "account_account"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    code_store: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    reconcile: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    non_trade: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    account_stock_variation_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    account_stock_expense_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    def __repr__(self) -> str:
        n = self.name.get("en_US", "") if isinstance(self.name, dict) else self.name
        return f"<AccountAccount(id={self.id}, code={self.code_store}, name={n!r})>"
