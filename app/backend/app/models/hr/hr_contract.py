"""HR contracts."""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class HrContract(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_contract table."""

    __tablename__ = "hr_contract"
    __mashora_model__ = "hr.contract"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employee.id"), nullable=False
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id"), nullable=True
    )
    job_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_job.id"), nullable=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    trial_date_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    state: Mapped[str] = mapped_column(
        String, default="draft", server_default="'draft'"
    )  # draft/open/close/cancel
    wage: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    contract_type: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )  # cdi/cdd/intern/freelance
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource_calendar_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    hr_responsible_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<HrContract id={self.id} name={self.name!r} state={self.state!r}>"
