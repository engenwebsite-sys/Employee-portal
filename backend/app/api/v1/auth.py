import base64
import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, get_current_user
from app.core.config import settings
from app.core.portal_date import portal_today
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models import Employee, Role, User
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
from app.services.employee_service import add_two_months
from app.services.microsoft_auth import build_microsoft_auth_url, exchange_code_for_profile

router = APIRouter(prefix="/auth", tags=["Auth"])
AUTH_COOKIE_PATH = "/api/v1/auth"
REFRESH_COOKIE = "nemilink_refresh"
MICROSOFT_COOKIE = "nemilink_microsoft_flow"


def _browser_session(request: Request) -> bool:
    return request.headers.get("X-Portal-Session") == "browser"


def _auth_result(request: Request, response: Response, tokens: TokenResponse) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    if _browser_session(request):
        response.set_cookie(
            REFRESH_COOKIE, tokens.refresh_token,
            max_age=settings.refresh_token_expire_days * 86400,
            path=AUTH_COOKIE_PATH, httponly=True, samesite="strict",
            secure=settings.environment != "development" or request.url.scheme == "https",
        )
        return tokens.model_copy(update={"refresh_token": None})
    return tokens


def _requested_refresh_token(request: Request, body: RefreshRequest | None) -> str | None:
    if _browser_session(request) and (token := request.cookies.get(REFRESH_COOKIE)):
        return token
    return body.refresh_token if body else None


@router.post("/login", response_model=TokenResponse, response_model_exclude_none=True,
             summary="Sign in with email and password")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
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
    return _auth_result(request, response, auth_service.issue_tokens(db, user))


@router.post("/refresh", response_model=TokenResponse, response_model_exclude_none=True,
             summary="Swap a refresh token for a new pair")
def refresh(request: Request, response: Response, body: RefreshRequest | None = None,
            db: Session = Depends(get_db)) -> TokenResponse:
    raw_token = _requested_refresh_token(request, body)
    tokens = auth_service.rotate_refresh_token(db, raw_token) if raw_token else None
    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again."
        )
    return _auth_result(request, response, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke a refresh token")
def logout(request: Request, body: RefreshRequest | None = None, db: Session = Depends(get_db)) -> Response:
    raw_token = _requested_refresh_token(request, body)
    if raw_token:
        auth_service.revoke_refresh_token(db, raw_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    if _browser_session(request):
        response.delete_cookie(REFRESH_COOKIE, path=AUTH_COOKIE_PATH)
    return response


@router.post(
    "/change-password",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Change your password (also used for the first-login change)",
)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),  # allowed even while must_change_password
    db: Session = Depends(get_db),
) -> TokenResponse:
    version = user.session_version
    auth_service.lock_user(db, user)
    if version != user.session_version or not user.is_active:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
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
    return _auth_result(request, response, auth_service.issue_tokens(db, user))


@router.get(
    "/microsoft/url",
    response_model=MicrosoftAuthUrlResponse,
    summary="Get Microsoft Entra ID sign-in URL",
)
def microsoft_login_url(request: Request, response: Response) -> MicrosoftAuthUrlResponse:
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    auth_url = build_microsoft_auth_url(state, challenge)
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        MICROSOFT_COOKIE, f"{state}.{verifier}", max_age=600,
        path=AUTH_COOKIE_PATH, httponly=True, samesite="lax",
        secure=settings.environment != "development" or request.url.scheme == "https",
    )
    return MicrosoftAuthUrlResponse(auth_url=auth_url)


@router.post(
    "/microsoft/callback",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Exchange Microsoft OAuth code for Nemilink session tokens",
)
def microsoft_callback(
    body: MicrosoftCallbackRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    expected_state, _, verifier = request.cookies.get(MICROSOFT_COOKIE, "").partition(".")
    if not verifier or not secrets.compare_digest(body.state.encode(), expected_state.encode()):
        raise HTTPException(status_code=400, detail="Invalid Microsoft sign-in session. Start sign-in again.")
    response.delete_cookie(MICROSOFT_COOKIE, path=AUTH_COOKIE_PATH)
    email, display_name = exchange_code_for_profile(body.code, verifier)
    domain = email.split("@")[-1].lower()

    if settings.allowed_domain_set and domain not in settings.allowed_domain_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized company domains are allowed to sign in.",
        )

    user = auth_service.get_user_by_email(db, email)
    if user is None:
        is_super = email.lower() in settings.super_admin_email_set
        # Auto-provision new company users. Super admins start with HR role; others with Employee role.
        user = User(
            email=email,
            role=Role.HR.value if is_super else Role.EMPLOYEE.value,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            is_active=True,
            must_change_password=False,
        )
        db.add(user)
        db.flush()
        today = portal_today()
        db.add(
            Employee(
                user_id=user.id,
                employee_code=f"EMP-{user.id:04d}",
                name=display_name or email.split("@")[0].replace(".", " ").title(),
                joining_date=today,
                probation_end_date=add_two_months(today),
            )
        )
        db.flush()
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is disabled. Please contact HR.",
        )

    user.must_change_password = False
    user.last_login_at = datetime.now(timezone.utc)
    return _auth_result(request, response, auth_service.issue_tokens(db, user))


@router.post(
    "/switch-role",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    summary="Switch active role (super-admin accounts only)",
)
def switch_role(
    body: SwitchRoleRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    version = user.session_version
    auth_service.lock_user(db, user)
    if version != user.session_version or user.must_change_password or not user.is_active:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super-admin accounts can switch roles.",
        )
    user.role = body.role
    return _auth_result(request, response, auth_service.issue_tokens(db, user))
