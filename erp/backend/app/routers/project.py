"""
Project module API endpoints.

Provides REST API for:
- Projects (CRUD)
- Tasks (CRUD + kanban stage + state management)
- Task Kanban Pipeline
- Milestones
- Status Updates
- Task Stages
- Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call
from app.schemas.project import (
    ProjectCreate,
    ProjectListParams,
    ProjectUpdate,
    TaskCreate,
    TaskListParams,
    TaskUpdate,
    MilestoneCreate,
    StatusUpdateCreate,
    TimesheetCreate,
    TimesheetUpdate,
    TimesheetListParams,
)
from app.services.project_service import (
    list_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    archive_project,
    restore_project,
    list_tasks,
    get_task,
    create_task,
    update_task,
    delete_task,
    move_task_stage,
    set_task_state,
    get_task_pipeline,
    list_milestones,
    create_milestone,
    list_updates,
    create_update,
    list_task_stages,
    get_project_dashboard,
    list_timesheets,
    get_timesheet,
    create_timesheet,
    update_timesheet,
    delete_timesheet,
    get_timesheet_summary,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Projects
# ============================================

@router.post("/list")
async def get_projects(params: ProjectListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List projects with filters."""
    p = params or ProjectListParams()
    return await orm_call(list_projects, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.get("/{project_id}")
async def get_project_detail(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full project details with milestones."""
    result = await orm_call(get_project, project_id=project_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return result


@router.post("/create", status_code=201)
async def create_new_project(body: ProjectCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new project."""
    return await orm_call(create_project, vals=body.model_dump(), uid=_uid(user), context=_ctx(user))


@router.put("/{project_id}")
async def update_existing_project(project_id: int, body: ProjectUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a project."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_project, project_id=project_id, vals=vals, uid=_uid(user), context=_ctx(user))


# ============================================
# Tasks
# ============================================

@router.post("/tasks")
async def get_tasks(params: TaskListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List tasks with filters."""
    p = params or TaskListParams()
    return await orm_call(list_tasks, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.get("/tasks/{task_id}")
async def get_task_detail(task_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full task details."""
    result = await orm_call(get_task, task_id=task_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return result


@router.post("/tasks/create", status_code=201)
async def create_new_task(body: TaskCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new task."""
    return await orm_call(create_task, vals=body.model_dump(), uid=_uid(user), context=_ctx(user))


@router.put("/tasks/{task_id}")
async def update_existing_task(task_id: int, body: TaskUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a task."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_task, task_id=task_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.post("/tasks/{task_id}/move-stage")
async def move_task(task_id: int, stage_id: int = Query(description="Target stage ID"), user: CurrentUser | None = Depends(get_optional_user)):
    """Move a task to a different kanban stage (drag-and-drop)."""
    return await orm_call(move_task_stage, task_id=task_id, stage_id=stage_id, uid=_uid(user), context=_ctx(user))


@router.post("/tasks/{task_id}/state")
async def change_task_state(
    task_id: int,
    state: str = Query(description="New state: 01_in_progress, 1_done, 1_canceled, etc."),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Change task state (done, canceled, in progress, etc.)."""
    return await orm_call(set_task_state, task_id=task_id, state=state, uid=_uid(user), context=_ctx(user))


# ============================================
# Task Kanban Pipeline
# ============================================

@router.get("/{project_id}/pipeline")
async def get_pipeline(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get tasks grouped by stage for kanban view."""
    return await orm_call(get_task_pipeline, project_id=project_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Task Stages
# ============================================

@router.get("/{project_id}/stages")
async def get_stages(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """List task stages for a project."""
    return await orm_call(list_task_stages, project_id=project_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Milestones
# ============================================

@router.get("/{project_id}/milestones")
async def get_milestones(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """List project milestones."""
    return await orm_call(list_milestones, project_id=project_id, uid=_uid(user), context=_ctx(user))


@router.post("/{project_id}/milestones", status_code=201)
async def create_new_milestone(project_id: int, body: MilestoneCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a project milestone."""
    vals = body.model_dump()
    vals["project_id"] = project_id
    return await orm_call(create_milestone, vals=vals, uid=_uid(user), context=_ctx(user))


# ============================================
# Status Updates
# ============================================

@router.get("/{project_id}/updates")
async def get_updates(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """List project status updates."""
    return await orm_call(list_updates, project_id=project_id, uid=_uid(user), context=_ctx(user))


@router.post("/{project_id}/updates", status_code=201)
async def create_new_update(project_id: int, body: StatusUpdateCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a project status update."""
    vals = body.model_dump()
    vals["project_id"] = project_id
    return await orm_call(create_update, vals=vals, uid=_uid(user), context=_ctx(user))


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard/metrics")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get project dashboard summary metrics."""
    return await orm_call(get_project_dashboard, uid=_uid(user), context=_ctx(user))


# ============================================
# Task delete
# ============================================

@router.delete("/tasks/{task_id}")
async def delete_existing_task(task_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Delete a task."""
    return await orm_call(delete_task, task_id=task_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Project archive / restore / delete
# ============================================

@router.post("/projects/{project_id}/archive")
async def archive_existing_project(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Archive a project (set active=False)."""
    return await orm_call(archive_project, project_id=project_id, uid=_uid(user), context=_ctx(user))


@router.post("/projects/{project_id}/restore")
async def restore_existing_project(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Restore an archived project (set active=True)."""
    return await orm_call(restore_project, project_id=project_id, uid=_uid(user), context=_ctx(user))


@router.delete("/projects/{project_id}")
async def delete_existing_project(project_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Delete a project."""
    return await orm_call(delete_project, project_id=project_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Timesheets
# ============================================

@router.post("/timesheets")
async def get_timesheets(params: TimesheetListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List timesheets with optional filters (project_id, employee_id, date_from, date_to)."""
    p = params or TimesheetListParams()
    domain = []
    if p.project_id:
        domain.append(('project_id', '=', p.project_id))
    if p.employee_id:
        domain.append(('employee_id', '=', p.employee_id))
    if p.date_from:
        domain.append(('date', '>=', p.date_from.isoformat()))
    if p.date_to:
        domain.append(('date', '<=', p.date_to.isoformat()))
    return await orm_call(
        list_timesheets,
        uid=_uid(user), context=_ctx(user),
        domain=domain, offset=p.offset, limit=p.limit, order=p.order,
    )


@router.get("/timesheets/summary")
async def timesheet_summary(
    project_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get timesheet summary grouped by project and employee."""
    return await orm_call(
        get_timesheet_summary,
        project_id=project_id, employee_id=employee_id,
        date_from=date_from, date_to=date_to,
        uid=_uid(user), context=_ctx(user),
    )


@router.get("/timesheets/{timesheet_id}")
async def get_timesheet_detail(timesheet_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get a timesheet entry by ID."""
    result = await orm_call(get_timesheet, timesheet_id=timesheet_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Timesheet {timesheet_id} not found")
    return result


@router.post("/timesheets/create", status_code=201)
async def create_new_timesheet(body: TimesheetCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new timesheet entry."""
    return await orm_call(create_timesheet, vals=body.model_dump(), uid=_uid(user), context=_ctx(user))


@router.put("/timesheets/{timesheet_id}")
async def update_existing_timesheet(timesheet_id: int, body: TimesheetUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a timesheet entry."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_timesheet, timesheet_id=timesheet_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.delete("/timesheets/{timesheet_id}")
async def delete_existing_timesheet(timesheet_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Delete a timesheet entry."""
    return await orm_call(delete_timesheet, timesheet_id=timesheet_id, uid=_uid(user), context=_ctx(user))
