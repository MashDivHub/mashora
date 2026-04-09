"""
Pydantic schemas for the Project module.

Covers: project.project, project.task, project.milestone, project.update.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """Create a new project."""
    name: str
    partner_id: Optional[int] = None
    user_id: Optional[int] = None
    date_start: Optional[date] = None
    date: Optional[date] = None
    privacy_visibility: Literal["followers", "invited_users", "employees", "portal"] = "employees"
    allow_milestones: bool = True
    allow_task_dependencies: bool = False
    tag_ids: list[int] = Field(default_factory=list)
    description: Optional[str] = None
    label_tasks: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Update an existing project."""
    name: Optional[str] = None
    partner_id: Optional[int] = None
    user_id: Optional[int] = None
    date_start: Optional[date] = None
    date: Optional[date] = None
    privacy_visibility: Optional[str] = None
    tag_ids: Optional[list[int]] = None
    description: Optional[str] = None


class ProjectListParams(BaseModel):
    """Parameters for listing projects."""
    user_id: Optional[int] = None
    partner_id: Optional[int] = None
    stage_id: Optional[int] = None
    active: Optional[bool] = True
    is_favorite: Optional[bool] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "sequence asc, name asc"


class TaskCreate(BaseModel):
    """Create a new task."""
    name: str
    project_id: Optional[int] = None
    user_ids: list[int] = Field(default_factory=list)
    parent_id: Optional[int] = None
    stage_id: Optional[int] = None
    priority: str = "0"
    date_deadline: Optional[datetime] = None
    description: Optional[str] = None
    tag_ids: list[int] = Field(default_factory=list)
    milestone_id: Optional[int] = None
    partner_id: Optional[int] = None
    allocated_hours: Optional[float] = None


class TaskUpdate(BaseModel):
    """Update an existing task."""
    name: Optional[str] = None
    stage_id: Optional[int] = None
    state: Optional[str] = None
    user_ids: Optional[list[int]] = None
    priority: Optional[str] = None
    date_deadline: Optional[datetime] = None
    description: Optional[str] = None
    tag_ids: Optional[list[int]] = None
    milestone_id: Optional[int] = None
    parent_id: Optional[int] = None
    partner_id: Optional[int] = None
    allocated_hours: Optional[float] = None


class TaskListParams(BaseModel):
    """Parameters for listing tasks."""
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    user_id: Optional[int] = None
    state: Optional[list[str]] = None
    priority: Optional[str] = None
    milestone_id: Optional[int] = None
    is_closed: Optional[bool] = None
    parent_id: Optional[int] = Field(default=None, description="Filter by parent task. Use 0 for root tasks only.")
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "priority desc, sequence asc, id desc"


class MilestoneCreate(BaseModel):
    """Create a project milestone."""
    name: str
    project_id: int
    deadline: Optional[date] = None


class StatusUpdateCreate(BaseModel):
    """Create a project status update."""
    project_id: int
    name: str
    status: Literal["on_track", "at_risk", "off_track", "on_hold", "done"] = "on_track"
    description: Optional[str] = None
    progress: int = 0


class TimesheetCreate(BaseModel):
    """Create a new timesheet entry."""
    project_id: int
    task_id: Optional[int] = None
    employee_id: Optional[int] = None
    name: str = "/"
    date: Optional[date] = None
    unit_amount: float = 0.0


class TimesheetUpdate(BaseModel):
    """Update an existing timesheet entry."""
    task_id: Optional[int] = None
    employee_id: Optional[int] = None
    name: Optional[str] = None
    date: Optional[date] = None
    unit_amount: Optional[float] = None


class TimesheetListParams(BaseModel):
    """Parameters for listing timesheets."""
    project_id: Optional[int] = None
    employee_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    offset: int = 0
    limit: int = 50
    order: str = "date desc"
