"""
HR module API endpoints.

Provides REST API for:
- Employees (CRUD + directory)
- Departments (hierarchy)
- Job Positions
- Attendance (check-in/check-out records)
- Leave/Time-Off (requests + approval workflow)
- Leave Types
- HR Dashboard
"""
from fastapi import APIRouter, HTTPException

from app.core.orm_adapter import orm_call
from app.schemas.hr import (
    EmployeeCreate,
    EmployeeListParams,
    EmployeeUpdate,
    DepartmentListParams,
    AttendanceListParams,
    LeaveCreate,
    LeaveListParams,
)
from app.services.hr_service import (
    list_employees,
    get_employee,
    create_employee,
    update_employee,
    list_departments,
    list_jobs,
    list_attendance,
    list_leaves,
    create_leave,
    approve_leave,
    refuse_leave,
    reset_leave,
    list_leave_types,
    get_hr_dashboard,
)

router = APIRouter(prefix="/hr", tags=["hr"])


# ============================================
# Employees
# ============================================

@router.post("/employees")
async def get_employees(params: EmployeeListParams | None = None):
    """List employees with filters."""
    p = params or EmployeeListParams()
    return await orm_call(list_employees, params=p.model_dump())


@router.get("/employees/{employee_id}")
async def get_employee_detail(employee_id: int):
    """Get full employee details."""
    result = await orm_call(get_employee, employee_id=employee_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")
    return result


@router.post("/employees/create", status_code=201)
async def create_new_employee(body: EmployeeCreate):
    """Create a new employee."""
    return await orm_call(create_employee, vals=body.model_dump())


@router.put("/employees/{employee_id}")
async def update_existing_employee(employee_id: int, body: EmployeeUpdate):
    """Update an employee."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_employee, employee_id=employee_id, vals=vals)


# ============================================
# Departments
# ============================================

@router.post("/departments")
async def get_departments(params: DepartmentListParams | None = None):
    """List departments (hierarchical)."""
    p = params or DepartmentListParams()
    return await orm_call(list_departments, params=p.model_dump())


# ============================================
# Job Positions
# ============================================

@router.get("/jobs")
async def get_jobs():
    """List job positions."""
    return await orm_call(list_jobs)


# ============================================
# Attendance
# ============================================

@router.post("/attendance")
async def get_attendance(params: AttendanceListParams | None = None):
    """List attendance records."""
    p = params or AttendanceListParams()
    return await orm_call(list_attendance, params=p.model_dump())


# ============================================
# Leave / Time-Off
# ============================================

@router.post("/leaves")
async def get_leaves(params: LeaveListParams | None = None):
    """List leave/time-off requests."""
    p = params or LeaveListParams()
    return await orm_call(list_leaves, params=p.model_dump())


@router.post("/leaves/create", status_code=201)
async def create_leave_request(body: LeaveCreate):
    """Create a new leave request."""
    return await orm_call(create_leave, vals=body.model_dump(exclude_none=True))


@router.post("/leaves/{leave_id}/approve")
async def approve_leave_request(leave_id: int):
    """Approve a leave request."""
    return await orm_call(approve_leave, leave_id=leave_id)


@router.post("/leaves/{leave_id}/refuse")
async def refuse_leave_request(leave_id: int):
    """Refuse a leave request."""
    return await orm_call(refuse_leave, leave_id=leave_id)


@router.post("/leaves/{leave_id}/reset")
async def reset_leave_request(leave_id: int):
    """Reset a leave request back to draft."""
    return await orm_call(reset_leave, leave_id=leave_id)


# ============================================
# Leave Types
# ============================================

@router.get("/leave-types")
async def get_leave_types():
    """List leave types (Sick, Annual, etc.)."""
    return await orm_call(list_leave_types)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get HR dashboard summary metrics."""
    return await orm_call(get_hr_dashboard)
