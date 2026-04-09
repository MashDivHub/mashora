"""
Project service layer.

Provides high-level operations for:
- Project CRUD
- Task CRUD with kanban stage management
- Milestones
- Status updates
- Task kanban pipeline data
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

PROJECT_LIST_FIELDS = [
    "id", "name", "active", "sequence",
    "user_id", "partner_id", "company_id",
    "date_start", "date", "stage_id",
    "task_count", "open_task_count", "closed_task_count",
    "task_completion_percentage",
    "tag_ids", "color",
    "last_update_status",
    "allow_milestones", "milestone_count", "milestone_count_reached",
    "label_tasks", "privacy_visibility",
    "is_favorite",
]

PROJECT_DETAIL_FIELDS = PROJECT_LIST_FIELDS + [
    "description",
    "type_ids",
    "allow_task_dependencies", "allow_recurring_tasks",
    "collaborator_count",
    "next_milestone_id",
    "update_ids",
    "create_date", "write_date",
]

TASK_LIST_FIELDS = [
    "id", "name", "project_id", "stage_id",
    "state", "is_closed",
    "user_ids", "partner_id",
    "priority", "sequence", "color",
    "date_deadline", "date_assign",
    "tag_ids", "milestone_id",
    "parent_id", "subtask_count", "subtask_completion_percentage",
    "depend_on_count", "dependent_tasks_count",
    "allocated_hours",
    "activity_date_deadline",
]

TASK_DETAIL_FIELDS = TASK_LIST_FIELDS + [
    "description",
    "child_ids", "depend_on_ids", "dependent_ids",
    "closed_subtask_count", "closed_depend_on_count",
    "working_hours_open", "working_hours_close",
    "working_days_open", "working_days_close",
    "date_end", "date_last_stage_update",
    "company_id",
    "create_date", "write_date",
]

MILESTONE_FIELDS = [
    "id", "name", "project_id", "deadline",
    "is_reached", "reached_date",
    "task_ids",
]

UPDATE_FIELDS = [
    "id", "name", "project_id", "user_id",
    "status", "description", "progress",
    "date", "create_date",
]

STAGE_FIELDS = [
    "id", "name", "sequence", "fold", "color",
    "project_ids",
]


# --- Projects ---

async def list_projects(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("active") is not None:
        domain.append(["active", "=", params["active"]])
    if params.get("user_id"):
        domain.append(["user_id", "=", params["user_id"]])
    if params.get("partner_id"):
        domain.append(["partner_id", "=", params["partner_id"]])
    if params.get("stage_id"):
        domain.append(["stage_id", "=", params["stage_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    # Exclude templates
    domain.append(["is_template", "=", False])

    return await async_search_read(
        "project.project",
        domain,
        PROJECT_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "sequence asc, name asc"),
    )


async def get_project(project_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    data = await async_get("project.project", project_id, PROJECT_DETAIL_FIELDS)
    if data is None:
        return None

    # Read milestones
    milestone_ids = data.get("milestone_ids") if "milestone_ids" in data else []
    if not milestone_ids:
        milestones_result = await async_search_read(
            "project.milestone",
            [["project_id", "=", project_id]],
            MILESTONE_FIELDS,
            limit=1000,
        )
        data["milestones"] = milestones_result["records"]
    return data


async def create_project(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "tag_ids" in clean_vals:
        clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
    return await async_create("project.project", clean_vals, uid, PROJECT_LIST_FIELDS)


async def update_project(project_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "tag_ids" in clean_vals:
        clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
    return await async_update("project.project", project_id, clean_vals, uid, PROJECT_LIST_FIELDS)


# --- Tasks ---

async def list_tasks(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = [["is_template", "=", False]]
    if params.get("project_id"):
        domain.append(["project_id", "=", params["project_id"]])
    if params.get("stage_id"):
        domain.append(["stage_id", "=", params["stage_id"]])
    if params.get("user_id"):
        domain.append(["user_ids", "in", [params["user_id"]]])
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("priority"):
        domain.append(["priority", "=", params["priority"]])
    if params.get("milestone_id"):
        domain.append(["milestone_id", "=", params["milestone_id"]])
    if params.get("is_closed") is not None:
        domain.append(["is_closed", "=", params["is_closed"]])
    if params.get("parent_id") is not None:
        parent = params["parent_id"]
        domain.append(["parent_id", "=", parent if parent != 0 else False])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    return await async_search_read(
        "project.task",
        domain,
        TASK_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "priority desc, sequence asc, id desc"),
    )


async def get_task(task_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    return await async_get("project.task", task_id, TASK_DETAIL_FIELDS)


async def create_task(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "user_ids" in clean_vals:
        clean_vals["user_ids"] = [(6, 0, clean_vals["user_ids"])]
    if "tag_ids" in clean_vals:
        clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
    return await async_create("project.task", clean_vals, uid, TASK_LIST_FIELDS)


async def update_task(task_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "user_ids" in clean_vals:
        clean_vals["user_ids"] = [(6, 0, clean_vals["user_ids"])]
    if "tag_ids" in clean_vals:
        clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
    return await async_update("project.task", task_id, clean_vals, uid, TASK_LIST_FIELDS)


async def move_task_stage(task_id: int, stage_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Move a task to a different kanban stage (drag-and-drop)."""
    return await async_update("project.task", task_id, {"stage_id": stage_id}, uid, TASK_LIST_FIELDS)


async def set_task_state(task_id: int, state: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Set task state (in_progress, done, canceled, etc.)."""
    return await async_update("project.task", task_id, {"state": state}, uid, TASK_LIST_FIELDS)


# --- Task Kanban Pipeline ---

async def get_task_pipeline(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get tasks grouped by stage for kanban view."""
    # Get stages for this project
    stages_result = await async_search_read(
        "project.task.type",
        [["project_ids", "=", project_id]],
        STAGE_FIELDS,
        limit=1000,
        order="sequence asc",
    )
    stage_data = stages_result["records"]

    pipeline = []
    for stage in stage_data:
        tasks_result = await async_search_read(
            "project.task",
            [
                ["project_id", "=", project_id],
                ["stage_id", "=", stage["id"]],
                ["is_template", "=", False],
            ],
            TASK_LIST_FIELDS,
            limit=100,
            order="priority desc, sequence asc, id desc",
        )
        pipeline.append({
            "stage": stage,
            "tasks": tasks_result["records"],
            "count": tasks_result["total"],
        })

    return {"pipeline": pipeline}


# --- Milestones ---

async def list_milestones(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "project.milestone",
        [["project_id", "=", project_id]],
        MILESTONE_FIELDS,
        limit=1000,
        order="deadline asc",
    )


async def create_milestone(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_create("project.milestone", clean_vals, uid, MILESTONE_FIELDS)


# --- Status Updates ---

async def list_updates(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "project.update",
        [["project_id", "=", project_id]],
        UPDATE_FIELDS,
        limit=1000,
        order="create_date desc",
    )


async def create_update(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_create("project.update", clean_vals, uid, UPDATE_FIELDS)


# --- Task Stages ---

async def list_task_stages(project_id: Optional[int] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if project_id:
        domain.append(["project_ids", "=", project_id])
    return await async_search_read("project.task.type", domain, STAGE_FIELDS, limit=1000, order="sequence asc")


# --- Dashboard ---

async def get_project_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    active_projects = await async_count("project.project", [
        ["active", "=", True],
        ["is_template", "=", False],
    ])

    # Task stats
    open_tasks = await async_count("project.task", [
        ["is_closed", "=", False],
        ["is_template", "=", False],
    ])
    closed_tasks = await async_count("project.task", [
        ["is_closed", "=", True],
        ["is_template", "=", False],
    ])

    # Overdue tasks
    import datetime
    today = datetime.date.today()
    overdue_tasks = await async_count("project.task", [
        ["is_closed", "=", False],
        ["is_template", "=", False],
        ["date_deadline", "<", today.isoformat()],
        ["date_deadline", "!=", False],
    ])

    # My tasks (for the current user)
    my_tasks = await async_count("project.task", [
        ["user_ids", "in", [uid]],
        ["is_closed", "=", False],
        ["is_template", "=", False],
    ])

    # Projects by status
    status_counts = {}
    for status in ["on_track", "at_risk", "off_track", "on_hold", "done"]:
        status_counts[status] = await async_count("project.project", [
            ["active", "=", True],
            ["is_template", "=", False],
            ["last_update_status", "=", status],
        ])

    return {
        "projects": {
            "active": active_projects,
            "status": status_counts,
        },
        "tasks": {
            "open": open_tasks,
            "closed": closed_tasks,
            "overdue": overdue_tasks,
            "my_tasks": my_tasks,
        },
    }


async def delete_task(task_id: int, uid: int = 1, context: Optional[dict] = None) -> bool:
    """Delete a task."""
    return await async_delete("project.task", task_id)


async def archive_project(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Archive a project (set active=False)."""
    return await async_update("project.project", project_id, {"active": False}, uid, PROJECT_LIST_FIELDS)


async def restore_project(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Restore an archived project (set active=True)."""
    return await async_update("project.project", project_id, {"active": True}, uid, PROJECT_LIST_FIELDS)


async def delete_project(project_id: int, uid: int = 1, context: Optional[dict] = None) -> bool:
    """Delete a project."""
    return await async_delete("project.project", project_id)


# --- Timesheets ---

PROJECT_FIELDS = PROJECT_LIST_FIELDS

TIMESHEET_BASE_FIELDS = [
    "id", "name", "date", "unit_amount", "user_id",
    "account_id", "partner_id", "amount",
    "create_date", "write_date",
]

TIMESHEET_OPTIONAL_FIELDS = ["project_id", "task_id", "employee_id"]

# TIMESHEET_FIELDS is set dynamically; this default is used as a fallback
TIMESHEET_FIELDS = TIMESHEET_BASE_FIELDS


def _timesheet_available() -> bool:
    """Return True if the timesheet module fields are available."""
    from app.core.model_registry import get_model_class as _get
    cls = _get("account.analytic.line")
    if cls is None:
        return False
    return hasattr(cls, "project_id")


def _timesheet_fields_list() -> list:
    """Return the timesheet field list, including optional fields if available."""
    from app.core.model_registry import get_model_class as _get
    cls = _get("account.analytic.line")
    if cls is None:
        return TIMESHEET_BASE_FIELDS
    extra = [f for f in TIMESHEET_OPTIONAL_FIELDS if hasattr(cls, f)]
    return TIMESHEET_BASE_FIELDS + extra


async def list_timesheets(uid: int = 1, context: Optional[dict] = None, domain=None, offset: int = 0, limit: int = 50, order: str = "date desc") -> dict:
    if not _timesheet_available():
        return {"records": [], "total": 0, "warning": "timesheet module not installed"}
    fields = _timesheet_fields_list()
    d = list(domain) if domain else []
    d.append(["project_id", "!=", False])
    return await async_search_read("account.analytic.line", d, fields, offset=offset, limit=limit, order=order)


async def get_timesheet(timesheet_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if not _timesheet_available():
        return None
    fields = _timesheet_fields_list()
    return await async_get("account.analytic.line", timesheet_id, fields)


async def create_timesheet(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if not _timesheet_available():
        raise RuntimeError("timesheet module not installed; cannot create timesheet")
    fields = _timesheet_fields_list()
    return await async_create("account.analytic.line", vals, uid, fields)


async def update_timesheet(timesheet_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if not _timesheet_available():
        raise RuntimeError("timesheet module not installed; cannot update timesheet")
    fields = _timesheet_fields_list()
    return await async_update("account.analytic.line", timesheet_id, vals, uid, fields)


async def delete_timesheet(timesheet_id: int, uid: int = 1, context: Optional[dict] = None) -> bool:
    if not _timesheet_available():
        raise RuntimeError("timesheet module not installed; cannot delete timesheet")
    return await async_delete("account.analytic.line", timesheet_id)


async def get_timesheet_summary(
    project_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get timesheet summary grouped by project and employee."""
    if not _timesheet_available():
        return {"by_project": [], "by_employee": [], "total_hours": 0, "warning": "timesheet module not installed"}

    from app.services.base import async_read_group, async_sum
    domain: list[Any] = [["project_id", "!=", False]]
    if project_id:
        domain.append(["project_id", "=", project_id])
    if employee_id:
        domain.append(["employee_id", "=", employee_id])
    if date_from:
        domain.append(["date", ">=", date_from])
    if date_to:
        domain.append(["date", "<=", date_to])

    by_project = await async_read_group(
        "account.analytic.line", domain, ["project_id", "unit_amount"], ["project_id"]
    )
    by_employee = await async_read_group(
        "account.analytic.line", domain, ["employee_id", "unit_amount"], ["employee_id"]
    )
    total = await async_sum("account.analytic.line", "unit_amount", domain)

    return {
        "by_project": by_project,
        "by_employee": by_employee,
        "total_hours": total,
    }
