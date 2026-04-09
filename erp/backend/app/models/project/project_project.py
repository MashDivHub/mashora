"""
SQLAlchemy model for project_project table.
"""
from typing import Optional, List
from datetime import date, datetime

from sqlalchemy import Integer, String, Text, Boolean, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class ProjectProject(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    __tablename__ = "project_project"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("account_analytic_account.id"), nullable=True)
    alias_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)
    stage_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_update_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    privacy_visibility: Mapped[str] = mapped_column(String, nullable=False)
    last_update_status: Mapped[str] = mapped_column(String, nullable=False)
    date_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    label_tasks: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    task_properties_definition: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allow_task_dependencies: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    allow_milestones: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    allow_recurring_tasks: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_template: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    partner: Mapped[Optional["ResPartner"]] = relationship("ResPartner", foreign_keys=[partner_id])
    tasks: Mapped[List["ProjectTask"]] = relationship("ProjectTask", back_populates="project")
    milestones: Mapped[List["ProjectMilestone"]] = relationship("ProjectMilestone", back_populates="project")

    def __repr__(self) -> str:
        return f"<ProjectProject id={self.id} name={self.name!r}>"
