"""HR payslips and payslip batches."""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class HrPayslipBatch(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_payslip_run table."""

    __tablename__ = "hr_payslip_run"
    __mashora_model__ = "hr.payslip.run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[date] = mapped_column(Date, nullable=False)
    state: Mapped[str] = mapped_column(
        String, default="draft", server_default="'draft'"
    )  # draft/verify/done

    def __repr__(self) -> str:
        return f"<HrPayslipBatch id={self.id} name={self.name!r} state={self.state!r}>"


class HrPayslip(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_payslip table."""

    __tablename__ = "hr_payslip"
    __mashora_model__ = "hr.payslip"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employee.id"), nullable=False
    )
    contract_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_contract.id"), nullable=True
    )
    payslip_run_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_payslip_run.id"), nullable=True
    )
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    state: Mapped[str] = mapped_column(
        String, default="draft", server_default="'draft'"
    )  # draft/verify/done/cancel
    number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    basic_wage: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    gross_wage: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    net_wage: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<HrPayslip id={self.id} name={self.name!r} state={self.state!r}>"
