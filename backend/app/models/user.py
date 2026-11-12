from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    HR = "hr"


class User(Base):
    """Login account. The profile (name, manager, etc.) lives in `employees`."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('employee', 'manager', 'hr')", name="role_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)  # stored lowercase
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=Role.EMPLOYEE.value)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Loaded together with the user so `user.name` never needs a second query.
    employee: Mapped[Optional["Employee"]] = relationship(  # noqa: F821
        back_populates="user", uselist=False, lazy="joined"
    )

    @property
    def name(self) -> Optional[str]:
        return self.employee.name if self.employee else None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )