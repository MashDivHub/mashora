"""
SQLAlchemy models for project_task, project_task_type, project_milestone tables.
"""
from typing import Optional, List
from datetime import date, datetime

from sqlalchemy import Integer, String, Text, Boolean, Date, Numeric, Double, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class ProjectTaskType(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "project_task_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mail_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rotting_threshold_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)
    sms_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    rating_status: Mapped[str] = mapped_column(String, nullable=False)
    rating_status_period: Mapped[str] = mapped_column(String, nullable=False)

    name: Mapped[dict] = mapped_column(JSONB, nullable=False)

    fold: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    auto_validation_state: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    rating_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    rating_request_deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    tasks: Mapped[List["ProjectTask"]] = relationship("ProjectTask", back_populates="stage")

    def __repr__(self) -> str:
        return f"<ProjectTaskType id={self.id} name={self.name!r}>"


class ProjectMilestone(Base, TimestampMixin):
    __tablename__ = "project_milestone"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("project_project.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reached_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_reached: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    project: Mapped["ProjectProject"] = relationship("ProjectProject", back_populates="milestones")

    def __repr__(self) -> str:
        return f"<ProjectMilestone id={self.id} name={self.name!r}>"


class ProjectTask(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    __tablename__ = "project_task"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stage_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("project_task_type.id"), nullable=True)
    project_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("project_project.id"), nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    displayed_image_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("project_task.id"), nullable=True)
    milestone_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("project_milestone.id"), nullable=True)
    recurrence_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    email_cc: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    priority: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[str] = mapped_column(String, nullable=False)
    partner_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_company_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    html_field_history: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    task_properties: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    working_hours_open: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    working_hours_close: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    display_in_project: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    recurring_task: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_template: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_template_ancestor: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    date_end: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    date_assign: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    date_deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    date_last_stage_update: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    rating_last_value: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    allocated_hours: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    working_days_open: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    working_days_close: Mapped[Optional[float]] = mapped_column(Double, nullable=True)

    # Relationships
    project: Mapped[Optional["ProjectProject"]] = relationship("ProjectProject", back_populates="tasks")
    stage: Mapped[Optional["ProjectTaskType"]] = relationship("ProjectTaskType", back_populates="tasks")
    partner: Mapped[Optional["ResPartner"]] = relationship("ResPartner", foreign_keys=[partner_id])
    milestone: Mapped[Optional["ProjectMilestone"]] = relationship("ProjectMilestone", foreign_keys=[milestone_id])
    parent: Mapped[Optional["ProjectTask"]] = relationship("ProjectTask", remote_side="ProjectTask.id", foreign_keys=[parent_id])
    child_tasks: Mapped[List["ProjectTask"]] = relationship("ProjectTask", foreign_keys=[parent_id], back_populates="parent")

    def __repr__(self) -> str:
        return f"<ProjectTask id={self.id} name={self.name!r}>"
