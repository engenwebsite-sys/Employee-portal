from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.employee import EmployeeOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class MicrosoftCallbackRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1, max_length=128)


class MicrosoftAuthUrlResponse(BaseModel):
    auth_url: str


class SwitchRoleRequest(BaseModel):
    role: str = Field(pattern="^(employee|manager|hr)$")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("New password must be at most 72 bytes.")
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("New password must include a letter and a number.")
        return value


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
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
