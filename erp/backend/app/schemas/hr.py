"""
Pydantic schemas for the HR module.

Covers: hr.employee, hr.department, hr.job, hr.attendance, hr.leave.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class EmployeeCreate(BaseModel):
    """Create a new employee."""
    name: str
    department_id: Optional[int] = None
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    parent_id: Optional[int] = None
    coach_id: Optional[int] = None
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    work_location_id: Optional[int] = None
    company_id: Optional[int] = None
    category_ids: list[int] = Field(default_factory=list)


class EmployeeUpdate(BaseModel):
    """Update an existing employee."""
    name: Optional[str] = None
    department_id: Optional[int] = None
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    parent_id: Optional[int] = None
    coach_id: Optional[int] = None
    work_email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    work_location_id: Optional[int] = None
    category_ids: Optional[list[int]] = None


class EmployeeListParams(BaseModel):
    """Parameters for listing employees."""
    department_id: Optional[int] = None
    job_id: Optional[int] = None
    parent_id: Optional[int] = None
    company_id: Optional[int] = None
    active: Optional[bool] = True
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "name asc"


class DepartmentListParams(BaseModel):
    """Parameters for listing departments."""
    parent_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 100
    order: str = "complete_name asc"


class AttendanceListParams(BaseModel):
    """Parameters for listing attendance records."""
    employee_id: Optional[int] = None
    department_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "check_in desc"


class LeaveCreate(BaseModel):
    """Create a leave/time-off request."""
    employee_id: int
    holiday_status_id: int
    request_date_from: date
    request_date_to: date
    request_date_from_period: Literal["am", "pm"] | None = None
    request_date_to_period: Literal["am", "pm"] | None = None
    name: Optional[str] = None
    notes: Optional[str] = None


class LeaveListParams(BaseModel):
    """Parameters for listing leave requests."""
    employee_id: Optional[int] = None
    department_id: Optional[int] = None
    holiday_status_id: Optional[int] = None
    state: Optional[list[str]] = Field(default=None, description="Filter: confirm, validate1, validate, refuse, cancel")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date_from desc"
