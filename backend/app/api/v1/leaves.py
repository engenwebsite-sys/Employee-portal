from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_roles
from app.db.session import get_db
from app.models.leave import LeaveStatus
from app.models.user import Role, User
from app.schemas.leave import (
    EmployeeLeaveDetailOut,
    EmployeeLeaveSummaryOut,
    LeaveAdjustmentCreate,
    LeaveAdjustmentOut,
    LeaveApply,
    LeaveBalanceOut,
    LeaveRequestOut,
    LeaveReview,
)
from app.services.leave_service import (
    _require_employee,
    apply_leave,
    cancel_leave,
    create_leave_adjustment,
    get_all_employees_leave_summary,
    get_balances_for_employee,
    get_employee_leave_detail,
    list_approvals,
    list_my_leaves,
    review_leave,
    to_leave_out,
)

router = APIRouter(prefix="/leaves", tags=["Leaves"])


@router.get("/balances", response_model=list[LeaveBalanceOut])
def api_leave_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    emp = _require_employee(current_user)
    return get_balances_for_employee(db, emp.id)


@router.get("/my", response_model=list[LeaveRequestOut])
def api_my_leaves(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    return [to_leave_out(r, db=db) for r in list_my_leaves(db, current_user)]


@router.post("", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def api_apply_leave(
    payload: LeaveApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    req = apply_leave(db, current_user, payload)
    return to_leave_out(req, db=db)


@router.post("/{leave_id}/cancel", response_model=LeaveRequestOut)
def api_cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    req = cancel_leave(db, current_user, leave_id)
    return to_leave_out(req, db=db)


@router.get("/approvals", response_model=list[LeaveRequestOut])
def api_list_approvals(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    return [
        to_leave_out(r, db=db, viewer=current_user)
        for r in list_approvals(db, current_user, status_filter=status_filter)
    ]


@router.post("/{leave_id}/approve", response_model=LeaveRequestOut)
def api_approve_leave(
    leave_id: int,
    payload: LeaveReview | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    req = review_leave(
        db,
        current_user,
        leave_id,
        LeaveStatus.APPROVED,
        comment=payload.comment if payload else None,
    )
    return to_leave_out(req, db=db, viewer=current_user)


@router.post("/{leave_id}/reject", response_model=LeaveRequestOut)
def api_reject_leave(
    leave_id: int,
    payload: LeaveReview | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    req = review_leave(
        db,
        current_user,
        leave_id,
        LeaveStatus.REJECTED,
        comment=payload.comment if payload else None,
    )
    return to_leave_out(req, db=db, viewer=current_user)


@router.get("/employees-summary", response_model=list[EmployeeLeaveSummaryOut])
def api_employees_leave_summary(
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    return get_all_employees_leave_summary(db, year=year, viewer=current_user)


@router.get("/employees/{employee_id}/detail", response_model=EmployeeLeaveDetailOut)
def api_employee_leave_detail(
    employee_id: int,
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    return get_employee_leave_detail(db, employee_id=employee_id, year=year, viewer=current_user)


@router.post(
    "/employees/{employee_id}/adjust",
    response_model=LeaveAdjustmentOut,
    status_code=status.HTTP_201_CREATED,
)
def api_adjust_leave_balance(
    employee_id: int,
    payload: LeaveAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.HR)),
):
    return create_leave_adjustment(db, employee_id=employee_id, payload=payload, current_user=current_user)
