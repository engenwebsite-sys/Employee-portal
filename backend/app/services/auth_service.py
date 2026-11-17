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
    user = db.scalar(
        select(User).where(User.email == email.strip().lower()).with_for_update(of=User)
    )
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
    tokens = TokenResponse(
        access_token=create_access_token(user.id, user.role, user.session_version),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )
    db.commit()
    return tokens


def rotate_refresh_token(db: Session, raw_token: str) -> TokenResponse | None:
    """One-time use: the old refresh token is revoked and a new pair is issued."""
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(raw_token)
    user = db.scalar(
        select(User)
        .join(RefreshToken, RefreshToken.user_id == User.id)
        .where(RefreshToken.token_hash == token_hash, User.is_active.is_(True))
        .with_for_update(of=User)
    )
    if user is None:
        return None
    user_id = db.scalar(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .returning(RefreshToken.user_id)
    )
    if user_id is None:
        return None
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


def lock_user(db: Session, user: User) -> None:
    db.scalar(select(User.id).where(User.id == user.id).with_for_update())
    db.refresh(user)


def set_password(db: Session, user: User, new_password: str, *, temporary: bool = False) -> None:
    user.password_hash = hash_password(new_password)
    user.must_change_password = temporary
    user.session_version += 1
    revoke_all_refresh_tokens(db, user.id)  # signs out every other session
