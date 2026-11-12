"""Role-guard test routes. Only registered when ENVIRONMENT=development.

They exist so you can prove the guards work from Postman before real HR/Manager
endpoints exist. Delete this file (and its line in router.py) once Step 3 is in.
"""
from fastapi import APIRouter, Depends

from app.api.deps import get_active_user, require_roles
from app.models import Role, User

router = APIRouter(prefix="/dev", tags=["Dev role checks"])


@router.get("/any-role", summary="Any signed-in user (password already changed)")
def any_role(user: User = Depends(get_active_user)) -> dict:
    return {"ok": True, "email": user.email, "role": user.role}


@router.get("/manager-or-hr", summary="Manager or HR only")
def manager_or_hr(user: User = Depends(require_roles(Role.MANAGER, Role.HR))) -> dict:
    return {"ok": True, "email": user.email, "role": user.role}


@router.get("/hr-only", summary="HR only")
def hr_only(user: User = Depends(require_roles(Role.HR))) -> dict:
    return {"ok": True, "email": user.email, "role": user.role}
