from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.employee import SelfProfileUpdate
from app.services.employee_service import get_employee_or_404, to_employee_out_dict, update_self_profile

router = APIRouter(tags=["Me"])


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