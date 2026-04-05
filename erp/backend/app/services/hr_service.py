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
from typing import Any

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
    "id", "name", "complete_name", "parent_id", "child_ids",
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
    "id", "employee_id", "holiday_status_id", "state",
    "number_of_days", "number_of_days_display",
    "date_from", "date_to",
    "name", "notes",
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
            order=params.get("order", "complete_name asc"),
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
        Leave = env["hr.leave"]
        total = Leave.search_count(domain)
        records = Leave.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date_from desc"),
        )
        return {"records": records.read(LEAVE_LIST_FIELDS), "total": total}


def create_leave(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        leave = env["hr.leave"].create(clean_vals)
        return leave.read(LEAVE_LIST_FIELDS)[0]


def approve_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        leave = env["hr.leave"].browse(leave_id)
        leave.action_approve()
        return leave.read(LEAVE_LIST_FIELDS)[0]


def refuse_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        leave = env["hr.leave"].browse(leave_id)
        leave.action_refuse()
        return leave.read(LEAVE_LIST_FIELDS)[0]


def reset_leave(leave_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        leave = env["hr.leave"].browse(leave_id)
        leave.action_draft()
        return leave.read(LEAVE_LIST_FIELDS)[0]


# --- Leave Types ---

def list_leave_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
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
