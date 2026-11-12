from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MicrosoftAuthUrlResponse,
    MicrosoftCallbackRequest,
    RefreshRequest,
    SwitchRoleRequest,
    TokenResponse,
)
from app.services import auth_service
from app.services.microsoft_auth import build_microsoft_auth_url, exchange_code_for_email

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse, summary="Sign in with email and password")
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is disabled. Please contact HR.",
        )
    user.last_login_at = datetime.now(timezone.utc)
    return auth_service.issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse, summary="Swap a refresh token for a new pair")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    tokens = auth_service.rotate_refresh_token(db, body.refresh_token)
    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again."
        )
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke a refresh token")
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> Response:
    auth_service.revoke_refresh_token(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/change-password",
    response_model=TokenResponse,
    summary="Change your password (also used for the first-login change)",
)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),  # allowed even while must_change_password
    db: Session = Depends(get_db),
) -> TokenResponse:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect."
        )
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one.",
        )
    auth_service.set_password(db, user, body.new_password)
    return auth_service.issue_tokens(db, user)


@router.get(
    "/microsoft/url",
    response_model=MicrosoftAuthUrlResponse,
    summary="Get Microsoft Entra ID sign-in URL",
)
def microsoft_login_url() -> MicrosoftAuthUrlResponse:
    return MicrosoftAuthUrlResponse(auth_url=build_microsoft_auth_url())


@router.post(
    "/microsoft/callback",
    response_model=TokenResponse,
    summary="Exchange Microsoft OAuth code for Nemilink session tokens",
)
def microsoft_callback(
    body: MicrosoftCallbackRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    email = exchange_code_for_email(body.code)
    domain = email.split("@")[-1].lower()

    if settings.allowed_domain_set and domain not in settings.allowed_domain_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized company domains are allowed to sign in.",
        )

    user = auth_service.get_user_by_email(db, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Microsoft account is not registered in Nemilink. Please contact HR.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is disabled. Please contact HR.",
        )

    user.must_change_password = False
    user.last_login_at = datetime.now(timezone.utc)
    return auth_service.issue_tokens(db, user)


@router.post(
    "/switch-role",
    response_model=TokenResponse,
    summary="Switch active role (super-admin accounts only)",
)
def switch_role(
    body: SwitchRoleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super-admin accounts can switch roles.",
        )
    user.role = body.role
    db.commit()
    return auth_service.issue_tokens(db, user)
