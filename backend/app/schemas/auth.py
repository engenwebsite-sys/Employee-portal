from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.employee import EmployeeOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class MicrosoftCallbackRequest(BaseModel):
    code: str = Field(min_length=1)


class MicrosoftAuthUrlResponse(BaseModel):
    auth_url: str


class SwitchRoleRequest(BaseModel):
    role: str = Field(pattern="^(employee|manager|hr)$")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    is_super_admin: bool = False
    must_change_password: bool
    last_login_at: Optional[datetime] = None
    employee: Optional[EmployeeOut] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut