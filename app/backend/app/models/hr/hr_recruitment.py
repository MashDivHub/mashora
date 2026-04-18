"""HR recruitment - applicants and stages."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class HrRecruitmentStage(Base, TimestampMixin):
    """Maps to hr_recruitment_stage table."""

    __tablename__ = "hr_recruitment_stage"
    __mashora_model__ = "hr.recruitment.stage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    fold: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    hired_stage: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    def __repr__(self) -> str:
        return f"<HrRecruitmentStage id={self.id} name={self.name!r}>"


class HrApplicant(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_applicant table."""

    __tablename__ = "hr_applicant"
    __mashora_model__ = "hr.applicant"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_name: Mapped[str] = mapped_column(String, nullable=False)
    email_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    job_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_job.id"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id"), nullable=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_recruitment_stage.id"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id"), nullable=True
    )  # recruiter
    salary_expected: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    salary_proposed: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    availability: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kanban_state: Mapped[str] = mapped_column(
        String, default="normal", server_default="'normal'"
    )
    priority: Mapped[str] = mapped_column(
        String, default="0", server_default="'0'"
    )
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id"), nullable=True
    )  # set on hire
    date_closed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    def __repr__(self) -> str:
        return f"<HrApplicant id={self.id} name={self.partner_name!r}>"
