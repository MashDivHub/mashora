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
from fastapi import APIRouter, HTTPException, Query

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
)
from app.services.project_service import (
    list_projects,
    get_project,
    create_project,
    update_project,
    list_tasks,
    get_task,
    create_task,
    update_task,
    move_task_stage,
    set_task_state,
    get_task_pipeline,
    list_milestones,
    create_milestone,
    list_updates,
    create_update,
    list_task_stages,
    get_project_dashboard,
)

router = APIRouter(prefix="/projects", tags=["projects"])


# ============================================
# Projects
# ============================================

@router.post("/list")
async def get_projects(params: ProjectListParams | None = None):
    """List projects with filters."""
    p = params or ProjectListParams()
    return await orm_call(list_projects, params=p.model_dump())


@router.get("/{project_id}")
async def get_project_detail(project_id: int):
    """Get full project details with milestones."""
    result = await orm_call(get_project, project_id=project_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return result


@router.post("/create", status_code=201)
async def create_new_project(body: ProjectCreate):
    """Create a new project."""
    return await orm_call(create_project, vals=body.model_dump())


@router.put("/{project_id}")
async def update_existing_project(project_id: int, body: ProjectUpdate):
    """Update a project."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_project, project_id=project_id, vals=vals)


# ============================================
# Tasks
# ============================================

@router.post("/tasks")
async def get_tasks(params: TaskListParams | None = None):
    """List tasks with filters."""
    p = params or TaskListParams()
    return await orm_call(list_tasks, params=p.model_dump())


@router.get("/tasks/{task_id}")
async def get_task_detail(task_id: int):
    """Get full task details."""
    result = await orm_call(get_task, task_id=task_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return result


@router.post("/tasks/create", status_code=201)
async def create_new_task(body: TaskCreate):
    """Create a new task."""
    return await orm_call(create_task, vals=body.model_dump())


@router.put("/tasks/{task_id}")
async def update_existing_task(task_id: int, body: TaskUpdate):
    """Update a task."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_task, task_id=task_id, vals=vals)


@router.post("/tasks/{task_id}/move-stage")
async def move_task(task_id: int, stage_id: int = Query(description="Target stage ID")):
    """Move a task to a different kanban stage (drag-and-drop)."""
    return await orm_call(move_task_stage, task_id=task_id, stage_id=stage_id)


@router.post("/tasks/{task_id}/state")
async def change_task_state(
    task_id: int,
    state: str = Query(description="New state: 01_in_progress, 1_done, 1_canceled, etc."),
):
    """Change task state (done, canceled, in progress, etc.)."""
    return await orm_call(set_task_state, task_id=task_id, state=state)


# ============================================
# Task Kanban Pipeline
# ============================================

@router.get("/{project_id}/pipeline")
async def get_pipeline(project_id: int):
    """Get tasks grouped by stage for kanban view."""
    return await orm_call(get_task_pipeline, project_id=project_id)


# ============================================
# Task Stages
# ============================================

@router.get("/{project_id}/stages")
async def get_stages(project_id: int):
    """List task stages for a project."""
    return await orm_call(list_task_stages, project_id=project_id)


# ============================================
# Milestones
# ============================================

@router.get("/{project_id}/milestones")
async def get_milestones(project_id: int):
    """List project milestones."""
    return await orm_call(list_milestones, project_id=project_id)


@router.post("/{project_id}/milestones", status_code=201)
async def create_new_milestone(project_id: int, body: MilestoneCreate):
    """Create a project milestone."""
    vals = body.model_dump()
    vals["project_id"] = project_id
    return await orm_call(create_milestone, vals=vals)


# ============================================
# Status Updates
# ============================================

@router.get("/{project_id}/updates")
async def get_updates(project_id: int):
    """List project status updates."""
    return await orm_call(list_updates, project_id=project_id)


@router.post("/{project_id}/updates", status_code=201)
async def create_new_update(project_id: int, body: StatusUpdateCreate):
    """Create a project status update."""
    vals = body.model_dump()
    vals["project_id"] = project_id
    return await orm_call(create_update, vals=vals)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard/metrics")
async def dashboard():
    """Get project dashboard summary metrics."""
    return await orm_call(get_project_dashboard)
