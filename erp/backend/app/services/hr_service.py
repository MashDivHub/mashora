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

from app.core.orm_adapter import mashora_env

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

def list_employees(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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

    with mashora_env(uid=uid, context=context) as env:
        Employee = env["hr.employee"]
        total = Employee.search_count(domain)
        records = Employee.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 50),
            order=params.get("order", "name asc"),
        )
        return {"records": records.read(EMPLOYEE_LIST_FIELDS), "total": total}


def get_employee(employee_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        emp = env["hr.employee"].browse(employee_id)
        if not emp.exists():
            return None
        return emp.read(EMPLOYEE_DETAIL_FIELDS)[0]


def create_employee(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "category_ids" in clean_vals:
            clean_vals["category_ids"] = [(6, 0, clean_vals["category_ids"])]
        emp = env["hr.employee"].create(clean_vals)
        return emp.read(EMPLOYEE_LIST_FIELDS)[0]


def update_employee(employee_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        emp = env["hr.employee"].browse(employee_id)
        if not emp.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Employee {employee_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "category_ids" in clean_vals:
            clean_vals["category_ids"] = [(6, 0, clean_vals["category_ids"])]
        emp.write(clean_vals)
        return emp.read(EMPLOYEE_LIST_FIELDS)[0]


# --- Departments ---

def list_departments(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("parent_id") is not None:
        domain.append(["parent_id", "=", params["parent_id"] or False])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    with mashora_env(uid=uid, context=context) as env:
        Dept = env["hr.department"]
        total = Dept.search_count(domain)
        records = Dept.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 100),
            order=params.get("order", "name asc"),
        )
        return {"records": records.read(DEPARTMENT_FIELDS), "total": total}


# --- Jobs ---

def list_jobs(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Job = env["hr.job"]
        records = Job.search([], order="sequence asc, name asc")
        return {"records": records.read(JOB_FIELDS), "total": len(records)}


# --- Attendance ---

def list_attendance(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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

    with mashora_env(uid=uid, context=context) as env:
        if 'hr.attendance' not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_attendance module not installed"}
        Att = env["hr.attendance"]
        total = Att.search_count(domain)
        records = Att.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 50),
            order=params.get("order", "check_in desc"),
        )
        return {"records": records.read(ATTENDANCE_FIELDS), "total": total}


# --- Leaves ---

def list_leaves(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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

    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}
        Leave = env["hr.leave"]
        total = Leave.search_count(domain)
        records = Leave.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date_from desc"),
        )
        return {"records": records.read(LEAVE_LIST_FIELDS), "total": total}


def get_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            return None
        leave = env["hr.leave"].browse(leave_id)
        if not leave.exists():
            return None
        return leave.read(LEAVE_LIST_FIELDS)[0]


def create_leave(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            raise RuntimeError("hr_holidays module not installed; cannot create leave")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        leave = env["hr.leave"].create(clean_vals)
        return leave.read(LEAVE_LIST_FIELDS)[0]


def approve_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        leave = env["hr.leave"].browse(leave_id)
        leave.action_approve()
        return leave.read(LEAVE_LIST_FIELDS)[0]


def refuse_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        leave = env["hr.leave"].browse(leave_id)
        leave.action_refuse()
        return leave.read(LEAVE_LIST_FIELDS)[0]


def reset_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        leave = env["hr.leave"].browse(leave_id)
        leave.action_draft()
        return leave.read(LEAVE_LIST_FIELDS)[0]


# --- Leave Types ---

def list_leave_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.type" not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}
        Type = env["hr.leave.type"]
        records = Type.search([], order="sequence asc")
        return {"records": records.read(LEAVE_TYPE_FIELDS), "total": len(records)}


# --- Dashboard ---

def get_hr_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Employee = env["hr.employee"]

        total_employees = Employee.search_count([("active", "=", True)])
        newly_hired = Employee.search_count([("newly_hired", "=", True)])

        # Department breakdown
        departments = env["hr.department"].search([])
        dept_data = departments.read(["name", "total_employee"])

        # Leaves pending approval
        pending_leaves = 0
        try:
            Leave = env["hr.leave"]
            pending_leaves = Leave.search_count([("state", "=", "confirm")])
        except Exception:
            pass

        # Today's attendance
        present_today = 0
        try:
            present_today = Employee.search_count([
                ("active", "=", True),
                ("hr_presence_state", "=", "present"),
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

def list_allocations(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "create_date desc") -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_holidays module not installed"}
        d = domain or []
        total = env['hr.leave.allocation'].search_count(d)
        records = env['hr.leave.allocation'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(ALLOCATION_FIELDS)
        return {"records": data, "total": total}


def get_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            return None
        record = env['hr.leave.allocation'].browse(allocation_id)
        if not record.exists():
            return None
        return record.read(ALLOCATION_FIELDS)[0]


def create_allocation(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            raise RuntimeError("hr_holidays module not installed; cannot create allocation")
        record = env['hr.leave.allocation'].create(vals)
        return record.read(ALLOCATION_FIELDS)[0]


def approve_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        record = env['hr.leave.allocation'].browse(allocation_id)
        record.action_validate()
        return record.read(ALLOCATION_FIELDS)[0]


def refuse_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        record = env['hr.leave.allocation'].browse(allocation_id)
        record.action_refuse()
        return record.read(ALLOCATION_FIELDS)[0]


def reset_allocation(allocation_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.leave.allocation" not in env.registry:
            raise RuntimeError("hr_holidays module not installed")
        record = env['hr.leave.allocation'].browse(allocation_id)
        record.action_draft()
        return record.read(ALLOCATION_FIELDS)[0]


# --- Expenses ---

def list_expenses(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "date desc") -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense" not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_expense module not installed"}
        d = domain or []
        total = env['hr.expense'].search_count(d)
        records = env['hr.expense'].search(d, offset=offset, limit=limit, order=order)
        return {"records": records.read(EXPENSE_FIELDS), "total": total}


def get_expense(expense_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense" not in env.registry:
            return None
        record = env['hr.expense'].browse(expense_id)
        if not record.exists():
            return None
        return record.read(EXPENSE_FIELDS)[0]


def create_expense(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense" not in env.registry:
            raise RuntimeError("hr_expense module not installed; cannot create expense")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        record = env['hr.expense'].create(clean_vals)
        return record.read(EXPENSE_FIELDS)[0]


def update_expense(expense_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense" not in env.registry:
            raise RuntimeError("hr_expense module not installed")
        record = env['hr.expense'].browse(expense_id)
        if not record.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Expense {expense_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        record.write(clean_vals)
        return record.read(EXPENSE_FIELDS)[0]


def submit_expenses(expense_ids: list, uid: int = 1, context: Optional[dict] = None):
    """Create expense sheet from selected expenses."""
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense" not in env.registry:
            raise RuntimeError("hr_expense module not installed")
        expenses = env['hr.expense'].browse(expense_ids)
        sheet = expenses.action_submit_expenses()
        if hasattr(sheet, 'read'):
            return sheet.read(EXPENSE_SHEET_FIELDS)[0]
        return sheet


# --- Expense Sheets ---

def list_expense_sheets(uid: int = 1, context: Optional[dict] = None, domain: Optional[list] = None, offset: int = 0, limit: int = 50, order: str = "create_date desc") -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense.sheet" not in env.registry:
            return {"records": [], "total": 0, "warning": "hr_expense module not installed"}
        d = domain or []
        total = env['hr.expense.sheet'].search_count(d)
        records = env['hr.expense.sheet'].search(d, offset=offset, limit=limit, order=order)
        return {"records": records.read(EXPENSE_SHEET_FIELDS), "total": total}


def approve_expense_sheet(sheet_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense.sheet" not in env.registry:
            raise RuntimeError("hr_expense module not installed")
        sheet = env['hr.expense.sheet'].browse(sheet_id)
        sheet.approve_expense_sheets()
        return sheet.read(EXPENSE_SHEET_FIELDS)[0]


def refuse_expense_sheet(sheet_id: int, reason: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense.sheet" not in env.registry:
            raise RuntimeError("hr_expense module not installed")
        sheet = env['hr.expense.sheet'].browse(sheet_id)
        sheet.action_sheet_refuse()
        return sheet.read(EXPENSE_SHEET_FIELDS)[0]


def post_expense_sheet(sheet_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "hr.expense.sheet" not in env.registry:
            raise RuntimeError("hr_expense module not installed")
        sheet = env['hr.expense.sheet'].browse(sheet_id)
        sheet.action_sheet_move_create()
        return sheet.read(EXPENSE_SHEET_FIELDS)[0]
