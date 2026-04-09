"""
IrSequence and IrSequenceDateRange models.
Maps to: ir_sequence, ir_sequence_date_range
"""
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, CompanyMixin, TimestampMixin


class IrSequence(TimestampMixin, ActiveMixin, CompanyMixin, Base):
    """Auto-incrementing sequence (ir_sequence)."""

    __tablename__ = "ir_sequence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    implementation: Mapped[str] = mapped_column(String, nullable=False)
    prefix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    suffix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    number_next: Mapped[int] = mapped_column(Integer, nullable=False)
    number_increment: Mapped[int] = mapped_column(Integer, nullable=False)
    padding: Mapped[int] = mapped_column(Integer, nullable=False)
    use_date_range: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    date_ranges: Mapped[list["IrSequenceDateRange"]] = relationship(
        "IrSequenceDateRange", back_populates="sequence"
    )

    def __repr__(self) -> str:
        return f"<IrSequence id={self.id} name={self.name!r} code={self.code!r}>"


class IrSequenceDateRange(TimestampMixin, Base):
    """Date-scoped sub-sequence (ir_sequence_date_range)."""

    __tablename__ = "ir_sequence_date_range"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    number_next: Mapped[int] = mapped_column(Integer, nullable=False)

    sequence_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_sequence.id", ondelete="CASCADE"), nullable=False
    )

    sequence: Mapped["IrSequence"] = relationship(
        "IrSequence", back_populates="date_ranges"
    )

    def __repr__(self) -> str:
        return (
            f"<IrSequenceDateRange id={self.id} sequence_id={self.sequence_id} "
            f"from={self.date_from} to={self.date_to}>"
        )
