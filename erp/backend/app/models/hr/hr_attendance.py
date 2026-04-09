"""
HR Attendance model.

Maps to existing PostgreSQL table: hr_attendance
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class HrAttendance(Base, TimestampMixin, CompanyMixin):
    """
    Maps to hr_attendance table.

    Records each employee check-in / check-out event.
    The worked_hours computed column is stored as a float (hours).
    """

    __tablename__ = "hr_attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    check_in: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    check_out: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    worked_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overtime_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reason: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    in_mode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    out_mode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    in_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    out_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    in_browser: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    out_browser: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HrAttendance id={self.id} employee_id={self.employee_id} "
            f"check_in={self.check_in} worked_hours={self.worked_hours}>"
        )
