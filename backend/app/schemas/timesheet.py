from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TimesheetEntryUpsert(BaseModel):
    work_date: date
    login_time: Optional[str] = Field(default=None, max_length=10)
    logout_time: Optional[str] = Field(default=None, max_length=10)
    project: Optional[str] = Field(default=None, max_length=150)
    task_description: str = Field(default="", max_length=5000)
    status: str = Field(default="In Progress", max_length=30)
    remarks: Optional[str] = Field(default=None, max_length=2000)
    day_type: str = Field(default="Working Day", max_length=30)


class TimesheetEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    employee_code: str
    employee_name: str
    department_name: Optional[str] = None
    work_date: date
    login_time: Optional[str] = None
    logout_time: Optional[str] = None
    project: Optional[str] = None
    task_description: str
    status: str
    remarks: Optional[str] = None
    day_type: str
    created_at: datetime
    updated_at: datetime

