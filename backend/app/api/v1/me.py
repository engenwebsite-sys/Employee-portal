from pathlib import Path
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.employee import SelfProfileUpdate
from app.services.employee_service import get_employee_or_404, to_employee_out_dict, update_self_profile

router = APIRouter(tags=["Me"])

AVATARS_DIR = Path("uploads") / "avatars"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


def _serialize_user(db: Session, user: User) -> dict:
    emp_dict = None
    if user.employee:
        emp = get_employee_or_404(db, user.employee.id)
        emp_dict = to_employee_out_dict(emp)
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "is_super_admin": user.is_super_admin,
        "must_change_password": user.must_change_password,
        "last_login_at": user.last_login_at,
        "employee": emp_dict,
    }


@router.get("/me", response_model=UserOut)
def read_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize_user(db, current_user)


@router.patch("/me", response_model=UserOut)
def patch_me(
    payload: SelfProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_self_profile(db, current_user, payload)
    db.refresh(current_user)
    return _serialize_user(db, current_user)


@router.post("/me/avatar", response_model=UserOut)
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No employee profile found for this account.",
        )

    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPG, PNG, WEBP, GIF.",
        )

    content = file.file.read()
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file size must be less than 5 MB.",
        )

    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"

    emp = current_user.employee
    # Clean up previous avatar if stored in uploads
    if emp.avatar_url and emp.avatar_url.startswith("/uploads/avatars/"):
        prev_file = Path(emp.avatar_url.lstrip("/"))
        if prev_file.exists():
            try:
                prev_file.unlink()
            except Exception:
                pass

    unique_filename = f"avatar_emp_{emp.id}_{uuid.uuid4().hex[:8]}.{ext}"
    target_path = AVATARS_DIR / unique_filename

    with open(target_path, "wb") as f:
        f.write(content)

    emp.avatar_url = f"/uploads/avatars/{unique_filename}"
    db.commit()
    db.refresh(emp)
    db.refresh(current_user)

    return _serialize_user(db, current_user)


@router.delete("/me/avatar", response_model=UserOut)
def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No employee profile found for this account.",
        )

    emp = current_user.employee
    if emp.avatar_url and emp.avatar_url.startswith("/uploads/avatars/"):
        prev_file = Path(emp.avatar_url.lstrip("/"))
        if prev_file.exists():
            try:
                prev_file.unlink()
            except Exception:
                pass

    emp.avatar_url = None
    db.commit()
    db.refresh(emp)
    db.refresh(current_user)

    return _serialize_user(db, current_user)
