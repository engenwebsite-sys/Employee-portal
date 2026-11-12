from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType
from app.models.user import Role, User
from app.schemas.leave import LeaveApply, LeaveBalanceOut, LeaveRequestOut

# Annual leave quotas per calendar year (unpaid has no fixed cap).
LEAVE_QUOTAS: list[tuple[str, str, int | None]] = [
    (LeaveType.CASUAL.value, "Casual Leave", 12),
    (LeaveType.SICK.value, "Sick Leave", 10),
    (LeaveType.EARNED.value, "Earned Leave", 15),
    (LeaveType.UNPAID.value, "Unpaid Leave", None),
]


def _require_employee(user: User) -> Employee:
    if not user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account does not have an employee profile yet.",
        )
    return user.employee


def to_leave_out(req: LeaveRequest) -> LeaveRequestOut:
    return LeaveRequestOut(
        id=req.id,
        employee_id=req.employee_id,
        employee_code=req.employee.employee_code,
        employee_name=req.employee.name,
        department_name=req.employee.department.name if req.employee.department else None,
        leave_type=req.leave_type,
        start_date=req.start_date,
        end_date=req.end_date,
        days=req.days,
        reason=req.reason,
        status=req.status,
        reviewed_by_email=req.reviewed_by.email if req.reviewed_by else None,
        review_comment=req.review_comment,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )


def _base_leave_query():
    return select(LeaveRequest).options(
        joinedload(LeaveRequest.employee).joinedload(Employee.department),
        joinedload(LeaveRequest.reviewed_by),
    )


def get_balances_for_employee(db: Session, employee_id: int, year: int | None = None) -> list[LeaveBalanceOut]:
    target_year = year or date.today().year
    year_start = date(target_year, 1, 1)
    year_end = date(target_year, 12, 31)

    rows = list(
        db.scalars(
            select(LeaveRequest).where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.start_date >= year_start,
                LeaveRequest.start_date <= year_end,
                LeaveRequest.status.in_([LeaveStatus.APPROVED.value, LeaveStatus.PENDING.value]),
            )
        ).all()
    )

    used_by_type: dict[str, int] = {}
    pending_by_type: dict[str, int] = {}
    for row in rows:
        if row.status == LeaveStatus.APPROVED.value:
            used_by_type[row.leave_type] = used_by_type.get(row.leave_type, 0) + row.days
        elif row.status == LeaveStatus.PENDING.value:
            pending_by_type[row.leave_type] = pending_by_type.get(row.leave_type, 0) + row.days

    balances: list[LeaveBalanceOut] = []
    for ltype, label, allocated in LEAVE_QUOTAS:
        used = used_by_type.get(ltype, 0)
        pending = pending_by_type.get(ltype, 0)
        available = None if allocated is None else max(allocated - used - pending, 0)
        balances.append(
            LeaveBalanceOut(
                leave_type=ltype,
                label=label,
                allocated=allocated,
                used=used,
                pending=pending,
                available=available,
            )
        )
    return balances


def list_my_leaves(db: Session, user: User) -> list[LeaveRequest]:
    emp = _require_employee(user)
    return list(
        db.scalars(
            _base_leave_query()
            .where(LeaveRequest.employee_id == emp.id)
            .order_by(LeaveRequest.created_at.desc())
        ).all()
    )


def apply_leave(db: Session, user: User, payload: LeaveApply) -> LeaveRequest:
    emp = _require_employee(user)
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date.",
        )

    days = (payload.end_date - payload.start_date).days + 1

    # Check overlapping pending/approved requests
    overlap = db.scalar(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status.in_([LeaveStatus.PENDING.value, LeaveStatus.APPROVED.value]),
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
        )
    )
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending or approved leave overlapping those dates.",
        )

    # Check balance for capped leave types
    balances = {b.leave_type: b for b in get_balances_for_employee(db, emp.id, payload.start_date.year)}
    bal = balances.get(payload.leave_type)
    if bal and bal.available is not None and days > bal.available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient {bal.label} balance ({bal.available} day(s) available).",
        )

    req = LeaveRequest(
        employee_id=emp.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days=days,
        reason=payload.reason.strip(),
        status=LeaveStatus.PENDING.value,
    )
    db.add(req)
    db.commit()
    return db.scalar(_base_leave_query().where(LeaveRequest.id == req.id))


def cancel_leave(db: Session, user: User, leave_id: int) -> LeaveRequest:
    emp = _require_employee(user)
    req = db.scalar(_base_leave_query().where(LeaveRequest.id == leave_id))
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    if req.employee_id != emp.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own leave requests.",
        )
    if req.status != LeaveStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be cancelled.",
        )
    req.status = LeaveStatus.CANCELLED.value
    db.commit()
    return db.scalar(_base_leave_query().where(LeaveRequest.id == req.id))


def list_approvals(db: Session, user: User, status_filter: str | None = None) -> list[LeaveRequest]:
    query = _base_leave_query()
    if user.role == Role.MANAGER.value:
        my_emp_id = user.employee.id if user.employee else -1
        query = query.join(LeaveRequest.employee).where(Employee.manager_id == my_emp_id)
    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)
    return list(db.scalars(query.order_by(LeaveRequest.created_at.desc())).all())


def review_leave(
    db: Session,
    user: User,
    leave_id: int,
    new_status: LeaveStatus,
    comment: str | None = None,
) -> LeaveRequest:
    req = db.scalar(_base_leave_query().where(LeaveRequest.id == leave_id))
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    if user.role == Role.MANAGER.value:
        my_emp_id = user.employee.id if user.employee else None
        if req.employee.manager_id != my_emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only review leave requests for their direct reportees.",
            )

    if req.status != LeaveStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change a request that is already {req.status}.",
        )

    req.status = new_status.value
    req.reviewed_by_id = user.id
    req.review_comment = comment.strip() if comment else None
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return db.scalar(_base_leave_query().where(LeaveRequest.id == req.id))

