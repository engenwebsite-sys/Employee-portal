"""Shared FastAPI dependencies: who is calling, and are they allowed."""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Valid token + the user still exists and is active. Role is read from the DB."""
    if credentials is None:
        raise _unauthorized("Not authenticated.")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise _unauthorized("Invalid or expired token.")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized("Account not found or disabled.")
    return user


def get_active_user(user: User = Depends(get_current_user)) -> User:
    """Like get_current_user, but blocks users who still must set a new password."""
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="password_change_required"
        )
    return user


def require_roles(*allowed: Role):
    """Usage: Depends(require_roles(Role.HR)) on any route that needs a role."""
    allowed_values = {role.value for role in allowed}

    def checker(user: User = Depends(get_active_user)) -> User:
        if user.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do this.",
            )
        return user

    return checker
