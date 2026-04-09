"""
HR Employee, Department, and Job models.

Maps to existing PostgreSQL tables: hr_employee, hr_department, hr_job
"""
from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import Integer, String, Boolean, ForeignKey, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class HrDepartment(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to hr_department table."""

    __tablename__ = "hr_department"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    master_department_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    parent: Mapped[Optional["HrDepartment"]] = relationship(
        "HrDepartment", remote_side="HrDepartment.id", foreign_keys=[parent_id]
    )
    children: Mapped[List["HrDepartment"]] = relationship(
        "HrDepartment", back_populates="parent", foreign_keys=[parent_id]
    )

    def __repr__(self) -> str:
        return f"<HrDepartment id={self.id}>"


class HrJob(Base, TimestampMixin, CompanyMixin):
    """Maps to hr_job table."""

    __tablename__ = "hr_job"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    requirements: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True
    )
    no_of_recruitment: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    no_of_hired_employee: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # Relationships
    department: Mapped[Optional["HrDepartment"]] = relationship(
        "HrDepartment", foreign_keys=[department_id]
    )

    def __repr__(self) -> str:
        return f"<HrJob id={self.id} department_id={self.department_id}>"


class HrEmployee(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to hr_employee table."""

    __tablename__ = "hr_employee"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="SET NULL"), nullable=True
    )
    coach_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resource_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    work_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    work_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    private_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    private_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    birthday: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    place_of_birth: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    permit_no: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visa_no: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visa_expire: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    barcode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    manager: Mapped[Optional["HrEmployee"]] = relationship(
        "HrEmployee", remote_side="HrEmployee.id", foreign_keys=[parent_id]
    )
    subordinates: Mapped[List["HrEmployee"]] = relationship(
        "HrEmployee", back_populates="manager", foreign_keys=[parent_id]
    )

    def __repr__(self) -> str:
        return f"<HrEmployee id={self.id} name={self.name!r}>"
