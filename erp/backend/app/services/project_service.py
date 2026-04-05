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
from typing import Any

from app.core.orm_adapter import mashora_env

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

def list_projects(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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

    with mashora_env(uid=uid, context=context) as env:
        Project = env["project.project"]
        total = Project.search_count(domain)
        records = Project.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "sequence asc, name asc"),
        )
        return {"records": records.read(PROJECT_LIST_FIELDS), "total": total}


def get_project(project_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        project = env["project.project"].browse(project_id)
        if not project.exists():
            return None
        data = project.read(PROJECT_DETAIL_FIELDS)[0]

        # Read milestones
        milestone_ids = data.get("milestone_ids") if "milestone_ids" in data else []
        if not milestone_ids:
            milestones = env["project.milestone"].search([("project_id", "=", project_id)])
            data["milestones"] = milestones.read(MILESTONE_FIELDS)
        return data


def create_project(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        project = env["project.project"].create(clean_vals)
        return project.read(PROJECT_LIST_FIELDS)[0]


def update_project(project_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        project = env["project.project"].browse(project_id)
        if not project.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Project {project_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        project.write(clean_vals)
        return project.read(PROJECT_LIST_FIELDS)[0]


# --- Tasks ---

def list_tasks(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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

    with mashora_env(uid=uid, context=context) as env:
        Task = env["project.task"]
        total = Task.search_count(domain)
        records = Task.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 50),
            order=params.get("order", "priority desc, sequence asc, id desc"),
        )
        return {"records": records.read(TASK_LIST_FIELDS), "total": total}


def get_task(task_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        task = env["project.task"].browse(task_id)
        if not task.exists():
            return None
        return task.read(TASK_DETAIL_FIELDS)[0]


def create_task(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "user_ids" in clean_vals:
            clean_vals["user_ids"] = [(6, 0, clean_vals["user_ids"])]
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        task = env["project.task"].create(clean_vals)
        return task.read(TASK_LIST_FIELDS)[0]


def update_task(task_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        task = env["project.task"].browse(task_id)
        if not task.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Task {task_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "user_ids" in clean_vals:
            clean_vals["user_ids"] = [(6, 0, clean_vals["user_ids"])]
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        task.write(clean_vals)
        return task.read(TASK_LIST_FIELDS)[0]


def move_task_stage(task_id: int, stage_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Move a task to a different kanban stage (drag-and-drop)."""
    with mashora_env(uid=uid, context=context) as env:
        task = env["project.task"].browse(task_id)
        task.write({"stage_id": stage_id})
        return task.read(TASK_LIST_FIELDS)[0]


def set_task_state(task_id: int, state: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Set task state (in_progress, done, canceled, etc.)."""
    with mashora_env(uid=uid, context=context) as env:
        task = env["project.task"].browse(task_id)
        task.write({"state": state})
        return task.read(TASK_LIST_FIELDS)[0]


# --- Task Kanban Pipeline ---

def get_task_pipeline(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get tasks grouped by stage for kanban view."""
    with mashora_env(uid=uid, context=context) as env:
        # Get stages for this project
        stages = env["project.task.type"].search(
            [("project_ids", "=", project_id)],
            order="sequence asc",
        )
        stage_data = stages.read(STAGE_FIELDS)

        Task = env["project.task"]
        pipeline = []
        for stage in stage_data:
            tasks = Task.search([
                ("project_id", "=", project_id),
                ("stage_id", "=", stage["id"]),
                ("is_template", "=", False),
            ], order="priority desc, sequence asc, id desc", limit=100)

            pipeline.append({
                "stage": stage,
                "tasks": tasks.read(TASK_LIST_FIELDS),
                "count": len(tasks),
            })

        return {"pipeline": pipeline}


# --- Milestones ---

def list_milestones(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Milestone = env["project.milestone"]
        records = Milestone.search(
            [("project_id", "=", project_id)],
            order="deadline asc",
        )
        return {"records": records.read(MILESTONE_FIELDS), "total": len(records)}


def create_milestone(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        milestone = env["project.milestone"].create(clean_vals)
        return milestone.read(MILESTONE_FIELDS)[0]


# --- Status Updates ---

def list_updates(project_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Update = env["project.update"]
        records = Update.search(
            [("project_id", "=", project_id)],
            order="create_date desc",
        )
        return {"records": records.read(UPDATE_FIELDS), "total": len(records)}


def create_update(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        update = env["project.update"].create(clean_vals)
        return update.read(UPDATE_FIELDS)[0]


# --- Task Stages ---

def list_task_stages(project_id: Optional[int] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        domain: list[Any] = []
        if project_id:
            domain.append(["project_ids", "=", project_id])
        stages = env["project.task.type"].search(domain, order="sequence asc")
        return {"records": stages.read(STAGE_FIELDS), "total": len(stages)}


# --- Dashboard ---

def get_project_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Project = env["project.project"]
        Task = env["project.task"]

        active_projects = Project.search_count([
            ("active", "=", True),
            ("is_template", "=", False),
        ])

        # Task stats
        open_tasks = Task.search_count([
            ("is_closed", "=", False),
            ("is_template", "=", False),
        ])
        closed_tasks = Task.search_count([
            ("is_closed", "=", True),
            ("is_template", "=", False),
        ])

        # Overdue tasks
        import datetime
        today = datetime.date.today()
        overdue_tasks = Task.search_count([
            ("is_closed", "=", False),
            ("is_template", "=", False),
            ("date_deadline", "<", today.isoformat()),
            ("date_deadline", "!=", False),
        ])

        # My tasks (for the current user)
        my_tasks = Task.search_count([
            ("user_ids", "in", [uid]),
            ("is_closed", "=", False),
            ("is_template", "=", False),
        ])

        # Projects by status
        status_counts = {}
        for status in ["on_track", "at_risk", "off_track", "on_hold", "done"]:
            status_counts[status] = Project.search_count([
                ("active", "=", True),
                ("is_template", "=", False),
                ("last_update_status", "=", status),
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
