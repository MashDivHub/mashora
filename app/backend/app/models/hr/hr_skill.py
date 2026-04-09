"""
HR Skill, Skill Type, Skill Level, and Employee Skill models.

Maps to existing PostgreSQL tables:
    hr_skill, hr_skill_type, hr_skill_level, hr_employee_skill
"""
from typing import Optional, List

from sqlalchemy import Integer, String, Boolean, ForeignKey, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class HrSkillType(Base, TimestampMixin):
    """Maps to hr_skill_type table."""

    __tablename__ = "hr_skill_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    skill_ids: Mapped[List["HrSkill"]] = relationship(
        "HrSkill", back_populates="skill_type", foreign_keys="HrSkill.skill_type_id"
    )
    skill_level_ids: Mapped[List["HrSkillLevel"]] = relationship(
        "HrSkillLevel", back_populates="skill_type", foreign_keys="HrSkillLevel.skill_type_id"
    )

    def __repr__(self) -> str:
        return f"<HrSkillType id={self.id}>"


class HrSkill(Base, TimestampMixin):
    """Maps to hr_skill table."""

    __tablename__ = "hr_skill"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    skill_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_skill_type.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    skill_type: Mapped[Optional["HrSkillType"]] = relationship(
        "HrSkillType", back_populates="skill_ids", foreign_keys=[skill_type_id]
    )

    def __repr__(self) -> str:
        return f"<HrSkill id={self.id} skill_type_id={self.skill_type_id}>"


class HrSkillLevel(Base, TimestampMixin):
    """Maps to hr_skill_level table."""

    __tablename__ = "hr_skill_level"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    skill_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_skill_type.id", ondelete="SET NULL"), nullable=True
    )
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_level: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    skill_type: Mapped[Optional["HrSkillType"]] = relationship(
        "HrSkillType", back_populates="skill_level_ids", foreign_keys=[skill_type_id]
    )

    def __repr__(self) -> str:
        return f"<HrSkillLevel id={self.id} progress={self.progress}>"


class HrEmployeeSkill(Base, TimestampMixin):
    """Maps to hr_employee_skill table."""

    __tablename__ = "hr_employee_skill"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_employee.id", ondelete="CASCADE"), nullable=True
    )
    skill_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_skill.id", ondelete="CASCADE"), nullable=True
    )
    skill_level_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_skill_level.id", ondelete="SET NULL"), nullable=True
    )
    skill_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hr_skill_type.id", ondelete="SET NULL"), nullable=True
    )
    level_progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    employee: Mapped[Optional["HrEmployee"]] = relationship(  # type: ignore[name-defined]
        "HrEmployee", foreign_keys=[employee_id]
    )
    skill: Mapped[Optional["HrSkill"]] = relationship(
        "HrSkill", foreign_keys=[skill_id]
    )
    skill_level: Mapped[Optional["HrSkillLevel"]] = relationship(
        "HrSkillLevel", foreign_keys=[skill_level_id]
    )
    skill_type: Mapped[Optional["HrSkillType"]] = relationship(
        "HrSkillType", foreign_keys=[skill_type_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HrEmployeeSkill id={self.id} employee_id={self.employee_id} "
            f"skill_id={self.skill_id} level_progress={self.level_progress}>"
        )
