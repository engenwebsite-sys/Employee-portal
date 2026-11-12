from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LeaveApply(BaseModel):
    leave_type: str = Field(pattern="^(casual|sick|earned|unpaid)$")
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=500)


class LeaveReview(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=500)


class LeaveBalanceOut(BaseModel):
    leave_type: str
    label: str
    allocated: Optional[int] = None  # None for unpaid leave
    used: int
    pending: int
    available: Optional[int] = None  # None for unpaid leave


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

