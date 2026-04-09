"""
HR Leave, Leave Type, and Leave Allocation models.

Maps to existing PostgreSQL tables: hr_leave, hr_leave_type, hr_leave_allocation
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class HrLeaveType(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to hr_leave_type table."""

    __tablename__ = "hr_leave_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color_name: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    request_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    leave_validation_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    allocation_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    validity_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    validity_stop: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    responsible_ids: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    requires_allocation: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    employee_requests: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    allocation_validation_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    hr_leave_type_accrual_rule_ids: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_allowed_negative: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    allows_negative: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    show_on_dashboard: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    unpaid: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    def __repr__(self) -> str:
        return f"<HrLeaveType id={self.id}>"


class HrLeave(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_leave table."""

    __tablename__ = "hr_leave"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    holiday_status_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_leave_type.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    holiday_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    date_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    number_of_days: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    number_of_hours_display: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    private_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    first_approver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    second_approver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    refuse_reason_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_leave_refuse_reason.id", ondelete="SET NULL"), nullable=True
    )
    payslip_state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    overtime_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_attendance_overtime.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    holiday_status: Mapped[Optional["HrLeaveType"]] = relationship(
        "HrLeaveType", foreign_keys=[holiday_status_id]
    )
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HrLeave id={self.id} state={self.state!r} "
            f"employee_id={self.employee_id} days={self.number_of_days}>"
        )


class HrLeaveAllocation(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_leave_allocation table."""

    __tablename__ = "hr_leave_allocation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    holiday_status_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_leave_type.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    holiday_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    allocation_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    number_of_days: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    number_of_hours_display: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    date_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    description: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    accrual_plan_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_leave_accrual_plan.id", ondelete="SET NULL"), nullable=True
    )
    lastcall: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    nextcall: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    holiday_status: Mapped[Optional["HrLeaveType"]] = relationship(
        "HrLeaveType", foreign_keys=[holiday_status_id]
    )
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HrLeaveAllocation id={self.id} state={self.state!r} "
            f"employee_id={self.employee_id} days={self.number_of_days}>"
        )
