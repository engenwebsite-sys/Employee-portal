from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator

OpeningStatus = Literal["Open", "On Hold", "Closed"]
ApplicationStage = Literal[
    "Applied", "Screening", "Tests", "Interviewing", "Offer", "Joined", "Not Shortlisted", "Rejected", "Withdrawn"
]
ApplicationDecision = Literal["In Process", "Hired", "Not Hired", "Candidate Refusal"]
Attendance = Literal["Scheduled", "Attended", "No Show", "Cancelled"]
InterviewResult = Literal["Pending", "Passed", "Failed", "On Hold"]


class HiringPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid", from_attributes=True)

    @field_validator("resume_url", "meeting_url", "linkedin_url", "github_url", "portfolio_url", "url", check_fields=False)
    @classmethod
    def https_only(cls, value: HttpUrl | None):
        if value and (value.scheme != "https" or value.username or value.password):
            raise ValueError("Use an HTTPS link without embedded credentials.")
        return value


class DomainFields(HiringPayload):
    name: str = Field(min_length=1, max_length=80)


class OpeningIdentity(HiringPayload):
    title: str = Field(min_length=2, max_length=150)
    division: str = Field(min_length=1, max_length=80)


class OpeningTrackerFields(OpeningIdentity):
    domain: str = Field(min_length=1, max_length=80)
    experience_required: str = Field(min_length=1, max_length=120)
    closing_date: date


class OpeningFields(OpeningIdentity):
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


class CandidateProjectLink(HiringPayload):
    name: str = Field(min_length=1, max_length=120)
    url: HttpUrl


class CandidateProfile(HiringPayload):
    city: str | None = Field(default=None, max_length=100)
    role_category: str | None = Field(default=None, max_length=80)
    preferred_position: str = Field(min_length=1, max_length=150)
    skills: str | None = Field(default=None, max_length=500)
    qualification: str | None = Field(default=None, max_length=150)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)
    source: str | None = Field(default=None, max_length=120)
    experience_type: Literal["Fresher", "Experienced"]
    experience_years: int | None = Field(default=None, ge=0, le=60)
    experience_months: int | None = Field(default=None, ge=0, le=11)
    company: str | None = Field(default=None, max_length=150)
    designation: str | None = Field(default=None, max_length=150)
    notice_period: str | None = Field(default=None, max_length=80)
    current_ctc_lpa: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    expected_ctc_lpa: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    joining_date: date | None = None
    linkedin_url: HttpUrl | None = None
    github_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None
    project_links: list[CandidateProjectLink] = Field(default_factory=list, max_length=12)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def remove_employment_details_for_fresher(self):
        if self.experience_type == "Fresher":
            self.experience_years = None
            self.experience_months = None
            self.company = None
            self.designation = None
            self.notice_period = None
            self.current_ctc_lpa = None
        return self


class CandidateFields(HiringPayload):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    resume_url: HttpUrl | None = None
    profile: CandidateProfile | None = None


class ApplicationTracking(HiringPayload):
    source: str | None = Field(default=None, max_length=120)
    experience: str | None = Field(default=None, max_length=120)
    referred_by: str | None = Field(default=None, max_length=150)
    applied_on: date | None = None
    notes: str | None = Field(default=None, max_length=5000)


class CandidateIntake(ApplicationTracking):
    role: str = Field(min_length=1, max_length=150)


class CandidateIntakeFields(CandidateFields):
    intake: CandidateIntake | None = None


class CandidateOut(CandidateIntakeFields):
    id: int


class CandidateLink(HiringPayload):
    opening_id: int = Field(gt=0)


class ApplicationFields(ApplicationTracking):
    candidate: CandidateFields
    stage: ApplicationStage = "Applied"
    decision: ApplicationDecision | None = None
    decision_on: date | None = None
    notice_period: str | None = Field(default=None, max_length=80)
    expected_ctc: str | None = Field(default=None, max_length=80)
    next_action: str | None = Field(default=None, max_length=250)


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
    domain: str | None
    experience_required: str | None
    closing_date: date | None
    rounds: list[str]
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
    referred_by: str | None
    applied_on: date | None
    decision: ApplicationDecision | None
    decision_on: date | None
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
    domains: list[str]
    openings: list[OpeningOut]
    talent_pool: list[CandidateOut]
    applications: list[ApplicationOut]
    managers: list[ManagerOption]
