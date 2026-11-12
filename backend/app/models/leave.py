from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LeaveType(str, Enum):
    CASUAL = "casual"
    SICK = "sick"
    EARNED = "earned"
    UNPAID = "unpaid"


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="valid_date_range"),
        CheckConstraint("days >= 1", name="positive_days"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    leave_type: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default=LeaveStatus.PENDING.value, index=True)
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    review_comment: Mapped[Optional[str]] = mapped_column(String(500))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship()  # noqa: F821
    reviewed_by: Mapped[Optional["User"]] = relationship()  # noqa: F821

