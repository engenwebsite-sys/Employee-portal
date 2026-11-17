from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LeaveApply(BaseModel):
    leave_type: str = Field(pattern="^(casual|sick|unpaid)$")
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=500)


class LeaveReview(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=500)


class LeaveBalanceOut(BaseModel):
    leave_type: str
    label: str
    allocated: Optional[int] = None  # 10 for CL, 2 for SL, None for unpaid
    accrued: Optional[int] = None    # Months completed / days accrued so far
    adjustments: int = 0             # Extra leaves or deductions made by HR
    used: int
    pending: int
    available: Optional[int] = None  # Remaining available to apply


class LeaveAdjustmentCreate(BaseModel):
    days: int = Field(ge=-30, le=30, description="Positive for credit, negative for deduction")
    leave_type: str = Field(default="casual", pattern="^(casual|sick)$")
    reason: str = Field(min_length=3, max_length=500)
    year: Optional[int] = None


class LeaveAdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    year: int
    leave_type: str
    days: int
    reason: str
    adjusted_by_id: Optional[int] = None
    adjusted_by_name: Optional[str] = None
    created_at: datetime


class EmployeeLeaveSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    employee_id: int
    employee_code: str
    name: str
    email: str
    department_name: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None
    joining_date: Optional[date] = None
    accrued: int
    adjustments: int
    used: int
    pending: int
    available: int


class EmployeeLeaveDetailOut(BaseModel):
    summary: EmployeeLeaveSummaryOut
    balances: list[LeaveBalanceOut]
    adjustments: list[LeaveAdjustmentOut]
    recent_leaves: list["LeaveRequestOut"]


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    employee_code: str
    employee_name: str
    department_name: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    days: int
    reason: str
    status: str
    reviewed_by_email: Optional[str] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    requires_hr_approval: bool = False
    team_conflicts: list[str] = []
    team_conflict_count: int = 0
