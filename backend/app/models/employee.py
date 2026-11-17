from datetime import date, datetime
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Employee(Base):
    """Profile and reporting line. One employee row per login (users) row."""

    __tablename__ = "employees"
    __table_args__ = (
        CheckConstraint("manager_id IS NULL OR manager_id <> id", name="not_own_manager"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    employee_code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    department_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), index=True
    )
    designation: Mapped[Optional[str]] = mapped_column(String(100))
    manager_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"), index=True
    )
    joining_date: Mapped[date] = mapped_column(Date)
    probation_end_date: Mapped[date] = mapped_column(Date)  # last day of probation
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="employee")  # noqa: F821
    department: Mapped[Optional[Department]] = relationship()
    manager: Mapped[Optional["Employee"]] = relationship(remote_side="Employee.id")

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def role(self) -> str:
        return self.user.role

    @property
    def is_active(self) -> bool:
        return self.user.is_active

    @property
    def microsoft_verified(self) -> bool | None:
        return self.user.microsoft_verified
