from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimesheetEntry(Base):
    """Daily work / timesheet log for an employee (one entry per date)."""

    __tablename__ = "timesheet_entries"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_timesheet_emp_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    work_date: Mapped[date] = mapped_column(Date, index=True)
    login_time: Mapped[Optional[str]] = mapped_column(String(10))
    logout_time: Mapped[Optional[str]] = mapped_column(String(10))
    project: Mapped[Optional[str]] = mapped_column(String(150))
    task_description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="In Progress")
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    day_type: Mapped[str] = mapped_column(String(30), default="Working Day")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship()  # noqa: F821

