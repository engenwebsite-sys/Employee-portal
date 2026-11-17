from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class EmployeeBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_code: str
    name: str
    designation: Optional[str] = None
    avatar_url: Optional[str] = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    email: str
    role: str
    is_active: bool
    microsoft_verified: bool | None = None
    employee_code: str
    name: str
    department: Optional[DepartmentOut] = None
    designation: Optional[str] = None
    manager: Optional[EmployeeBrief] = None
    joining_date: date
    probation_end_date: date
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime


class EmployeeCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="employee", pattern="^(employee|manager|hr)$")
    employee_code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=150)
    department_id: Optional[int] = None
    designation: Optional[str] = Field(default=None, max_length=100)
    manager_id: Optional[int] = None
    joining_date: date
    probation_end_date: Optional[date] = None  # defaults to joining_date + 2 months
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=255)


class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = Field(default=None, min_length=2, max_length=20)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(default=None, pattern="^(employee|manager|hr)$")
    is_active: Optional[bool] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    department_id: Optional[int] = None
    designation: Optional[str] = Field(default=None, max_length=100)
    manager_id: Optional[int] = None
    joining_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=255)


class SelfProfileUpdate(BaseModel):
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=255)
