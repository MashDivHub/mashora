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
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call
from app.schemas.hr import (
    EmployeeCreate,
    EmployeeListParams,
    EmployeeUpdate,
    DepartmentListParams,
    AttendanceListParams,
    LeaveCreate,
    LeaveListParams,
    AllocationCreate,
    AllocationListParams,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseListParams,
    ExpenseSubmitBody,
    ExpenseSheetListParams,
    ExpenseSheetRefuseBody,
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
    list_allocations,
    get_allocation,
    create_allocation,
    approve_allocation,
    refuse_allocation,
    reset_allocation,
    list_expenses,
    get_expense,
    create_expense,
    update_expense,
    submit_expenses,
    list_expense_sheets,
    approve_expense_sheet,
    refuse_expense_sheet,
    post_expense_sheet,
)

router = APIRouter(prefix="/hr", tags=["hr"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Employees
# ============================================

@router.post("/employees")
async def get_employees(params: EmployeeListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List employees with filters."""
    p = params or EmployeeListParams()
    return await orm_call(list_employees, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.get("/employees/{employee_id}")
async def get_employee_detail(employee_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full employee details."""
    result = await orm_call(get_employee, employee_id=employee_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")
    return result


@router.post("/employees/create", status_code=201)
async def create_new_employee(body: EmployeeCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new employee."""
    return await orm_call(create_employee, vals=body.model_dump(), uid=_uid(user), context=_ctx(user))


@router.put("/employees/{employee_id}")
async def update_existing_employee(employee_id: int, body: EmployeeUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update an employee."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_employee, employee_id=employee_id, vals=vals, uid=_uid(user), context=_ctx(user))


# ============================================
# Departments
# ============================================

@router.post("/departments")
async def get_departments(params: DepartmentListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List departments (hierarchical)."""
    p = params or DepartmentListParams()
    return await orm_call(list_departments, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


# ============================================
# Job Positions
# ============================================

@router.get("/jobs")
async def get_jobs(user: CurrentUser | None = Depends(get_optional_user)):
    """List job positions."""
    return await orm_call(list_jobs, uid=_uid(user), context=_ctx(user))


# ============================================
# Attendance
# ============================================

@router.post("/attendance")
async def get_attendance(params: AttendanceListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List attendance records."""
    p = params or AttendanceListParams()
    return await orm_call(list_attendance, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


# ============================================
# Leave / Time-Off
# ============================================

@router.post("/leaves")
async def get_leaves(params: LeaveListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List leave/time-off requests."""
    p = params or LeaveListParams()
    return await orm_call(list_leaves, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.post("/leaves/create", status_code=201)
async def create_leave_request(body: LeaveCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new leave request."""
    return await orm_call(create_leave, vals=body.model_dump(exclude_none=True), uid=_uid(user), context=_ctx(user))


@router.post("/leaves/{leave_id}/approve")
async def approve_leave_request(leave_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Approve a leave request."""
    return await orm_call(approve_leave, leave_id=leave_id, uid=_uid(user), context=_ctx(user))


@router.post("/leaves/{leave_id}/refuse")
async def refuse_leave_request(leave_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Refuse a leave request."""
    return await orm_call(refuse_leave, leave_id=leave_id, uid=_uid(user), context=_ctx(user))


@router.post("/leaves/{leave_id}/reset")
async def reset_leave_request(leave_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Reset a leave request back to draft."""
    return await orm_call(reset_leave, leave_id=leave_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Leave Types
# ============================================

@router.get("/leave-types")
async def get_leave_types(user: CurrentUser | None = Depends(get_optional_user)):
    """List leave types (Sick, Annual, etc.)."""
    return await orm_call(list_leave_types, uid=_uid(user), context=_ctx(user))


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get HR dashboard summary metrics."""
    return await orm_call(get_hr_dashboard, uid=_uid(user), context=_ctx(user))


# ============================================
# Leave Allocations
# ============================================

@router.post("/allocations")
async def get_allocations(params: AllocationListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List leave allocations with filters."""
    p = params or AllocationListParams()
    domain = []
    if p.employee_id:
        domain.append(["employee_id", "=", p.employee_id])
    if p.holiday_status_id:
        domain.append(["holiday_status_id", "=", p.holiday_status_id])
    if p.state:
        domain.append(["state", "in", p.state])
    return await orm_call(list_allocations, domain=domain, offset=p.offset, limit=p.limit, order=p.order, uid=_uid(user), context=_ctx(user))


@router.get("/allocations/{allocation_id}")
async def get_allocation_detail(allocation_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get a single leave allocation."""
    result = await orm_call(get_allocation, allocation_id=allocation_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Allocation {allocation_id} not found")
    return result


@router.post("/allocations/create", status_code=201)
async def create_allocation_endpoint(body: AllocationCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new leave allocation."""
    return await orm_call(create_allocation, vals=body.model_dump(exclude_none=True), uid=_uid(user), context=_ctx(user))


@router.post("/allocations/{allocation_id}/approve")
async def approve_allocation_endpoint(allocation_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Approve a leave allocation."""
    return await orm_call(approve_allocation, allocation_id=allocation_id, uid=_uid(user), context=_ctx(user))


@router.post("/allocations/{allocation_id}/refuse")
async def refuse_allocation_endpoint(allocation_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Refuse a leave allocation."""
    return await orm_call(refuse_allocation, allocation_id=allocation_id, uid=_uid(user), context=_ctx(user))


@router.post("/allocations/{allocation_id}/reset")
async def reset_allocation_endpoint(allocation_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Reset a leave allocation back to draft."""
    return await orm_call(reset_allocation, allocation_id=allocation_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Expenses
# ============================================

@router.post("/expenses")
async def get_expenses(params: ExpenseListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List expenses with filters."""
    p = params or ExpenseListParams()
    domain = []
    if p.employee_id:
        domain.append(["employee_id", "=", p.employee_id])
    if p.state:
        domain.append(["state", "in", p.state])
    if p.date_from:
        domain.append(["date", ">=", str(p.date_from)])
    if p.date_to:
        domain.append(["date", "<=", str(p.date_to)])
    return await orm_call(list_expenses, domain=domain, offset=p.offset, limit=p.limit, order=p.order, uid=_uid(user), context=_ctx(user))


@router.get("/expenses/{expense_id}")
async def get_expense_detail(expense_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get a single expense."""
    result = await orm_call(get_expense, expense_id=expense_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Expense {expense_id} not found")
    return result


@router.post("/expenses/create", status_code=201)
async def create_expense_endpoint(body: ExpenseCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new expense."""
    return await orm_call(create_expense, vals=body.model_dump(), uid=_uid(user), context=_ctx(user))


@router.put("/expenses/{expense_id}")
async def update_expense_endpoint(expense_id: int, body: ExpenseUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update an expense."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_expense, expense_id=expense_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.post("/expenses/submit")
async def submit_expenses_endpoint(body: ExpenseSubmitBody, user: CurrentUser | None = Depends(get_optional_user)):
    """Create an expense sheet from selected expenses."""
    return await orm_call(submit_expenses, expense_ids=body.expense_ids, uid=_uid(user), context=_ctx(user))


# ============================================
# Expense Sheets
# ============================================

@router.post("/expense-sheets")
async def get_expense_sheets(params: ExpenseSheetListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List expense sheets with filters."""
    p = params or ExpenseSheetListParams()
    domain = []
    if p.employee_id:
        domain.append(["employee_id", "=", p.employee_id])
    if p.state:
        domain.append(["state", "in", p.state])
    return await orm_call(list_expense_sheets, domain=domain, offset=p.offset, limit=p.limit, order=p.order, uid=_uid(user), context=_ctx(user))


@router.post("/expense-sheets/{sheet_id}/approve")
async def approve_expense_sheet_endpoint(sheet_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Approve an expense sheet."""
    return await orm_call(approve_expense_sheet, sheet_id=sheet_id, uid=_uid(user), context=_ctx(user))


@router.post("/expense-sheets/{sheet_id}/refuse")
async def refuse_expense_sheet_endpoint(sheet_id: int, body: ExpenseSheetRefuseBody, user: CurrentUser | None = Depends(get_optional_user)):
    """Refuse an expense sheet."""
    return await orm_call(refuse_expense_sheet, sheet_id=sheet_id, reason=body.reason, uid=_uid(user), context=_ctx(user))


@router.post("/expense-sheets/{sheet_id}/post")
async def post_expense_sheet_endpoint(sheet_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Post an expense sheet (create journal entries)."""
    return await orm_call(post_expense_sheet, sheet_id=sheet_id, uid=_uid(user), context=_ctx(user))
