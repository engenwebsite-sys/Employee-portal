from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: Optional[str] = Field(default=None, max_length=30)
    client: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    status: str = Field(default="Active", pattern="^(Active|Completed|On Hold|Archived)$")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    code: Optional[str] = Field(default=None, max_length=30)
    client: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(Active|Completed|On Hold|Archived)$")


class ProjectOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    client: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

