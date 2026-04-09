"""
HR service layer.

Provides high-level operations for:
- Employee CRUD and directory
- Department hierarchy
- Attendance tracking
- Leave/time-off requests with approval workflow
- Dashboard metrics
"""
import logging
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_search_read,
    async_count,
    async_get,
    async_get_or_raise,
    async_create,
    async_update,
    async_delete,
    async_action,
)
from app.core.model_registry import get_model_class

_logger = logging.getLogger(__name__)

EMPLOYEE_LIST_FIELDS = [
    "id", "name", "department_id", "job_id", "job_title",
    "parent_id", "coach_id",
    "work_email", "work_phone", "mobile_phone",
    "work_location_id", "work_location_type",
    "company_id", "category_ids",
    "hr_presence_state", "image_128",
    "active",
]

EMPLOYEE_DETAIL_FIELDS = EMPLOYEE_LIST_FIELDS + [
    "user_id", "barcode",
    "birthday", "sex", "country_of_birth",
    "identification_id", "passport_id",
    "permit_no", "visa_no", "visa_expire",
    "private_email", "private_phone",
    "contract_date_start", "contract_date_end",
    "contract_type_id", "contract_wage",
    "child_ids",
    "create_date", "write_date",
]

DEPARTMENT_FIELDS = [
    "id", "name", "parent_id", "child_ids",
    "manager_id", "total_employee", "company_id",
    "color", "parent_path",
]

JOB_FIELDS = [
    "id", "name", "department_id", "company_id",
    "no_of_employee", "no_of_recruitment", "expected_employees",
    "contract_type_id", "description",
]

ATTENDANCE_FIELDS = [
    "id", "employee_id", "department_id",
    "check_in", "check_out", "date",
    "worked_hours", "overtime_hours",
    "in_mode", "out_mode",
]

LEAVE_LIST_FIELDS = [
    "id", "employee_id", "department_id",
    "holiday_status_id", "state",
    "date_from", "date_to",
    "request_date_from", "request_date_to",
    "number_of_days", "duration_display",
    "name", "first_approver_id", "second_approver_id",
    "can_approve", "can_refuse",
]

LEAVE_TYPE_FIELDS = [
    "id", "name", "color", "sequence",
    "requires_allocation", "leave_validation_type",
    "request_unit",
    "max_leaves", "leaves_taken", "virtual_remaining_leaves",
]

ALLOCATION_FIELDS = [
    "id", "employee_id", "holiday_status_id", "number_of_days",
    "state", "date_from", "date_to", "notes",
    "create_date", "write_date",
]

EXPENSE_FIELDS = [
    "id", "name", "employee_id", "product_id", "unit_amount",
    "quantity", "total_amount", "date", "state", "payment_mode",
    "description", "sheet_id", "create_date", "write_date",
]

EXPENSE_SHEET_FIELDS = [
    "id", "name", "employee_id", "expense_line_ids", "total_amount",
    "state", "payment_state", "company_id",
    "create_date", "write_date",
]


# --- Employees ---

async def list_employees(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("active") is not None:
        domain.append(["active", "=", params["active"]])
    if params.get("department_id"):
        domain.append(["department_id", "=", params["department_id"]])
    if params.get("job_id"):
        domain.append(["job_id", "=", params["job_id"]])
    if params.get("parent_id"):
        domain.append(["parent_id", "=", params["parent_id"]])
    if params.get("company_id"):
        domain.append(["company_id", "=", params["company_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["work_email", "ilike", params["search"]])
        domain.append(["job_title", "ilike", params["search"]])

    return await async_search_read(
        "hr.employee",
        domain,
        EMPLOYEE_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "name asc"),
    )


async def get_employee(employee_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    return await async_get("hr.employee", employee_id, EMPLOYEE_DETAIL_FIELDS)


async def create_employee(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "category_ids" in clean_vals:
        clean_vals["category_ids"] = [(6, 0, clean_vals["category_ids"])]
    return await async_create("hr.employee", clean_vals, uid, EMPLOYEE_LIST_FIELDS)


async def update_employee(employee_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "category_ids" in clean_vals:
        clean_vals["category_ids"] = [(6, 0, clean_vals["category_ids"])]
    return await async_update("hr.employee", employee_id, clean_vals, uid, EMPLOYEE_LIST_FIELDS)


# --- Departments ---

async def list_departments(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("parent_id") is not None:
        domain.append(["parent_id", "=", params["parent_id"] or False])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    return await async_search_read(
        "hr.department",
        domain,
        DEPARTMENT_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 100),
        order=params.get("order", "name asc"),
    )


# --- Jobs ---

async def list_jobs(uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "hr.job",
        [],
        JOB_FIELDS,
        limit=1000,
        order="sequence asc, name asc",
    )


# --- Attendance ---

async def list_attendance(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("employee_id"):
        domain.append(["employee_id", "=", params["employee_id"]])
    if params.get("department_id"):
        domain.append(["department_id", "=", params["department_id"]])
    if params.get("date_from"):
        domain.append(["check_in", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["check_in", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["employee_id.name", "ilike", params["search"]])

    if get_model_class("hr.attendance") is None:
        return {"records": [], "total": 0, "warning": "hr_attendance module not installed"}

    return await async_search_read(
        "hr.attendance",
        domain,
        ATTENDANCE_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "check_in desc"),
    )


# --- Leaves ---

async def list_leaves(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("employee_id"):
        domain.append(["employee_id", "=", params["employee_id"]])
    if params.get("department_id"):
        domain.append(["department_id", "=", params["department_id"]])
    if params.get("holiday_status_id"):
        domain.append(["holiday_status_id", "=", params["holiday_status_id"]])
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("date_from"):
        domain.append(["date_from", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date_to", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["employee_id.name", "ilike", params["search"]])

    if get_model_class("hr.leave") is None:
        return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}

    return await async_search_read(
        "hr.leave",
        domain,
        LEAVE_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_from desc"),
    )


async def get_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("hr.leave") is None:
        return None
    return await async_get("hr.leave", leave_id, LEAVE_LIST_FIELDS)


async def create_leave(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave") is None:
        raise RuntimeError("hr_holidays module not installed; cannot create leave")
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_create("hr.leave", clean_vals, uid, LEAVE_LIST_FIELDS)


async def approve_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave", leave_id, "state", "validate", uid=uid, fields=LEAVE_LIST_FIELDS)


async def refuse_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave", leave_id, "state", "refuse", uid=uid, fields=LEAVE_LIST_FIELDS)


async def reset_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave", leave_id, "state", "draft", uid=uid, fields=LEAVE_LIST_FIELDS)


# --- Leave Types ---

async def list_leave_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave.type") is None:
        return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}
    return await async_search_read("hr.leave.type", [], LEAVE_TYPE_FIELDS, limit=1000, order="sequence asc")


# --- Dashboard ---

async def get_hr_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    total_employees = await async_count("hr.employee", [["active", "=", True]])
    newly_hired = await async_count("hr.employee", [["newly_hired", "=", True]])

    # Department breakdown
    dept_result = await async_search_read("hr.department", [], ["name", "total_employee"], limit=1000)
    dept_data = dept_result["records"]

    # Leaves pending approval
    pending_leaves = 0
    try:
        if get_model_class("hr.leave") is not None:
            pending_leaves = await async_count("hr.leave", [["state", "=", "confirm"]])
    except Exception:
        pass

    # Today's attendance
    present_today = 0
    try:
        present_today = await async_count("hr.employee", [
            ["active", "=", True],
            ["hr_presence_state", "=", "present"],
        ])
    except Exception:
        pass

    return {
        "employees": {
            "total": total_employees,
            "newly_hired": newly_hired,
            "present_today": present_today,
        },
        "departments": dept_data,
        "pending_leaves": pending_leaves,
    }


# --- Leave Allocations ---

async def list_allocations(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "create_date desc") -> dict:
    if get_model_class("hr.leave.allocation") is None:
        return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}
    d = domain or []
    return await async_search_read("hr.leave.allocation", d, ALLOCATION_FIELDS, offset=offset, limit=limit, order=order)


async def get_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("hr.leave.allocation") is None:
        return None
    return await async_get("hr.leave.allocation", allocation_id, ALLOCATION_FIELDS)


async def create_allocation(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave.allocation") is None:
        raise RuntimeError("hr_holidays module not installed; cannot create allocation")
    return await async_create("hr.leave.allocation", vals, uid, ALLOCATION_FIELDS)


async def approve_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave.allocation") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave.allocation", allocation_id, "state", "validate", uid=uid, fields=ALLOCATION_FIELDS)


async def refuse_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave.allocation") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave.allocation", allocation_id, "state", "refuse", uid=uid, fields=ALLOCATION_FIELDS)


async def reset_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.leave.allocation") is None:
        raise RuntimeError("hr_holidays module not installed")
    return await async_action("hr.leave.allocation", allocation_id, "state", "draft", uid=uid, fields=ALLOCATION_FIELDS)


# --- Expenses ---

async def list_expenses(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "date desc") -> dict:
    if get_model_class("hr.expense") is None:
        return {"records": [], "total": 0, "warning": "hr_expense module not installed"}
    d = domain or []
    return await async_search_read("hr.expense", d, EXPENSE_FIELDS, offset=offset, limit=limit, order=order)


async def get_expense(expense_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("hr.expense") is None:
        return None
    return await async_get("hr.expense", expense_id, EXPENSE_FIELDS)


async def create_expense(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.expense") is None:
        raise RuntimeError("hr_expense module not installed; cannot create expense")
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_create("hr.expense", clean_vals, uid, EXPENSE_FIELDS)


async def update_expense(expense_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.expense") is None:
        raise RuntimeError("hr_expense module not installed")
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_update("hr.expense", expense_id, clean_vals, uid, EXPENSE_FIELDS)


async def submit_expenses(expense_ids: list, uid: int = 1, context: Optional[dict] = None):
    """Create expense sheet from selected expenses."""
    if get_model_class("hr.expense") is None:
        raise RuntimeError("hr_expense module not installed")
    # Create an expense sheet grouping the given expense IDs
    sheet_vals = {
        "expense_line_ids": [(6, 0, expense_ids)],
    }
    return await async_create("hr.expense.sheet", sheet_vals, uid, EXPENSE_SHEET_FIELDS)


# --- Expense Sheets ---

async def list_expense_sheets(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "create_date desc") -> dict:
    if get_model_class("hr.expense.sheet") is None:
        return {"records": [], "total": 0, "warning": "hr_expense module not installed"}
    d = domain or []
    return await async_search_read("hr.expense.sheet", d, EXPENSE_SHEET_FIELDS, offset=offset, limit=limit, order=order)


async def approve_expense_sheet(sheet_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.expense.sheet") is None:
        raise RuntimeError("hr_expense module not installed")
    return await async_action("hr.expense.sheet", sheet_id, "state", "approve", uid=uid, fields=EXPENSE_SHEET_FIELDS)


async def refuse_expense_sheet(sheet_id: int, reason: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.expense.sheet") is None:
        raise RuntimeError("hr_expense module not installed")
    return await async_action("hr.expense.sheet", sheet_id, "state", "refuse", uid=uid, fields=EXPENSE_SHEET_FIELDS)


async def post_expense_sheet(sheet_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("hr.expense.sheet") is None:
        raise RuntimeError("hr_expense module not installed")
    return await async_action("hr.expense.sheet", sheet_id, "state", "post", uid=uid, fields=EXPENSE_SHEET_FIELDS)
