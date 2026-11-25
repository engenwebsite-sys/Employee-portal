from datetime import date, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class HiringOpening(Base):
    __tablename__ = "hiring_openings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    division: Mapped[str] = mapped_column(String(80))
    vacancies: Mapped[int]
    status: Mapped[str] = mapped_column(String(20))
    target_joining_date: Mapped[date | None]
    rounds: Mapped[list[str]] = mapped_column(JSON)
    hr_owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    manager_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    hr_owner: Mapped[User] = relationship(foreign_keys=[hr_owner_id])
    manager: Mapped[User] = relationship(foreign_keys=[manager_id])


class HiringCandidate(Base):
    __tablename__ = "hiring_candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    resume_url: Mapped[str | None] = mapped_column(Text)


class HiringApplication(Base):
    __tablename__ = "hiring_applications"
    __table_args__ = (UniqueConstraint("opening_id", "candidate_id", name="uq_hiring_application_candidate"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    opening_id: Mapped[int] = mapped_column(ForeignKey("hiring_openings.id"), index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("hiring_candidates.id"))
    stage: Mapped[str] = mapped_column(String(20))
    source: Mapped[str | None] = mapped_column(String(120))
    experience: Mapped[str | None] = mapped_column(String(120))
    notice_period: Mapped[str | None] = mapped_column(String(80))
    expected_ctc: Mapped[str | None] = mapped_column(String(80))
    next_action: Mapped[str | None] = mapped_column(String(250))
    notes: Mapped[str | None] = mapped_column(Text)
    candidate: Mapped[HiringCandidate] = relationship()
    opening: Mapped[HiringOpening] = relationship()
    interviews: Mapped[list["HiringInterview"]] = relationship(order_by="HiringInterview.starts_at")


class HiringInterview(Base):
    __tablename__ = "hiring_interviews"
    __table_args__ = (UniqueConstraint("application_id", "round_name", name="uq_hiring_interview_round"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("hiring_applications.id"), index=True)
    round_name: Mapped[str] = mapped_column(String(100))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    meeting_url: Mapped[str | None] = mapped_column(Text)
    attendance: Mapped[str] = mapped_column(String(20))
    result: Mapped[str] = mapped_column(String(20))
    feedback: Mapped[str | None] = mapped_column(Text)
    notifications: Mapped[list["HiringNotification"]] = relationship(order_by="HiringNotification.id.desc()")


class HiringNotification(Base):
    __tablename__ = "hiring_notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    interview_id: Mapped[int] = mapped_column(ForeignKey("hiring_interviews.id"), index=True)
    event: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))
    recipients: Mapped[list[str]] = mapped_column(JSON)
    remaining_recipients: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    reply_to: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(String(250))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
