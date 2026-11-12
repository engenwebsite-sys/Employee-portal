"""Login, token rotation and logout rules. Routes stay thin and call these."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.schemas.auth import TokenResponse, UserOut


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Returns the user only when email and password match."""
    user = get_user_by_email(db, email)
    if user is None:
        verify_password(password, DUMMY_HASH)  # keep timing similar
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(db: Session, user: User) -> TokenResponse:
    raw_refresh = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


def rotate_refresh_token(db: Session, raw_token: str) -> TokenResponse | None:
    """One-time use: the old refresh token is revoked and a new pair is issued."""
    row = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    now = datetime.now(timezone.utc)
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        return None
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        return None
    row.revoked_at = now
    return issue_tokens(db, user)  # commits both changes together


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(raw_token),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()


def revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )


def set_password(db: Session, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    revoke_all_refresh_tokens(db, user.id)  # signs out every other session
    db.commit()
