from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator

OpeningStatus = Literal["Open", "On Hold", "Closed"]
ApplicationStage = Literal["Applied", "Screening", "Interviewing", "Offer", "Joined", "Rejected", "Withdrawn"]
Attendance = Literal["Scheduled", "Attended", "No Show", "Cancelled"]
InterviewResult = Literal["Pending", "Passed", "Failed", "On Hold"]


class HiringPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid", from_attributes=True)

    @field_validator("resume_url", "meeting_url", check_fields=False)
    @classmethod
    def https_only(cls, value: HttpUrl | None):
        if value and (value.scheme != "https" or value.username or value.password):
            raise ValueError("Use an HTTPS link without embedded credentials.")
        return value


class OpeningFields(HiringPayload):
    title: str = Field(min_length=2, max_length=150)
    division: str = Field(min_length=1, max_length=80)
    vacancies: int = Field(ge=1, le=500)
    status: OpeningStatus = "Open"
    target_joining_date: date | None = None
    rounds: list[str] = Field(min_length=1, max_length=20)
    manager_id: int = Field(gt=0)
    hr_owner_id: int | None = Field(default=None, gt=0)

    @field_validator("rounds")
    @classmethod
    def validate_rounds(cls, values: list[str]):
        values = [value.strip() for value in values]
        if any(not value or len(value) > 100 for value in values):
            raise ValueError("Round names must contain 1–100 characters.")
        if len({value.casefold() for value in values}) != len(values):
            raise ValueError("Round names must be unique within an opening.")
        return values


class CandidateFields(HiringPayload):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr = Field(max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    resume_url: HttpUrl | None = None


class ApplicationFields(HiringPayload):
    candidate: CandidateFields
    stage: ApplicationStage = "Applied"
    source: str | None = Field(default=None, max_length=120)
    experience: str | None = Field(default=None, max_length=120)
    notice_period: str | None = Field(default=None, max_length=80)
    expected_ctc: str | None = Field(default=None, max_length=80)
    next_action: str | None = Field(default=None, max_length=250)
    notes: str | None = Field(default=None, max_length=5000)


class ApplicationCreate(ApplicationFields):
    opening_id: int = Field(gt=0)


class InterviewSchedule(HiringPayload):
    round_name: str = Field(min_length=1, max_length=100)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    meeting_url: HttpUrl | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("The end time must be after the start time.")
        return self


class InterviewReview(HiringPayload):
    attendance: Attendance
    result: InterviewResult = "Pending"
    feedback: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_result(self):
        if self.result != "Pending" and self.attendance != "Attended":
            raise ValueError("Record attendance before setting the result.")
        return self


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event: str
    status: str
    recipients: list[str]
    error: str | None
    created_at: datetime


class InterviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    round_name: str
    starts_at: datetime
    ends_at: datetime
    meeting_url: str | None
    attendance: Attendance
    result: InterviewResult
    feedback: str | None
    notifications: list[NotificationOut]


class OpeningOut(OpeningFields):
    id: int
    hr_owner_email: str
    manager_email: str


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    opening_id: int
    candidate: CandidateFields
    stage: ApplicationStage
    source: str | None
    experience: str | None
    notice_period: str | None
    expected_ctc: str | None
    next_action: str | None
    notes: str | None
    interviews: list[InterviewOut]


class ManagerOption(BaseModel):
    role: str
    id: int
    name: str
    email: str


class HiringOverview(BaseModel):
    openings: list[OpeningOut]
    applications: list[ApplicationOut]
    managers: list[ManagerOption]
