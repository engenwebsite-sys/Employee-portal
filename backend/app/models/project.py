from datetime import datetime
from enum import StrEnum
from typing import Optional

from sqlalchemy import DateTime, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectDivision(StrEnum):
    MAARGA = "Maarga"
    NEMILINK = "Nemilink"

    @classmethod
    def from_email(cls, email: str) -> Optional["ProjectDivision"]:
        _, _, domain = email.strip().lower().partition("@")
        return {"maargaai.com": cls.MAARGA, "nemilink.com": cls.NEMILINK}.get(domain)


class Project(Base):
    """Company project master model."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(30), unique=True, nullable=True)
    client: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True)
    division: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @classmethod
    def visible_to_email(cls, email: str):
        division = ProjectDivision.from_email(email)
        return cls.division == division if division else false()

