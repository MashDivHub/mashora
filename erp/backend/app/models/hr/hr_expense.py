"""
HR Expense and Expense Sheet models.

Maps to existing PostgreSQL tables: hr_expense, hr_expense_sheet
"""
from datetime import date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class HrExpenseSheet(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_expense_sheet table."""

    __tablename__ = "hr_expense_sheet"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    account_move_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_move.id", ondelete="SET NULL"), nullable=True
    )
    bank_journal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_journal.id", ondelete="SET NULL"), nullable=True
    )
    total_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    total_amount_company: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    payment_mode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    accounting_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )
    expenses: Mapped[List["HrExpense"]] = relationship(
        "HrExpense", back_populates="sheet", foreign_keys="HrExpense.sheet_id"
    )

    def __repr__(self) -> str:
        return f"<HrExpenseSheet id={self.id} name={self.name!r} state={self.state!r}>"


class HrExpense(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_expense table."""

    __tablename__ = "hr_expense"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    sheet_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_expense_sheet.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_account.id", ondelete="SET NULL"), nullable=True
    )
    analytic_distribution: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    unit_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    total_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    total_amount_company: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    payment_mode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_refused: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Relationships
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )
    sheet: Mapped[Optional["HrExpenseSheet"]] = relationship(
        "HrExpenseSheet", back_populates="expenses", foreign_keys=[sheet_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HrExpense id={self.id} name={self.name!r} "
            f"total={self.total_amount} state={self.state!r}>"
        )
