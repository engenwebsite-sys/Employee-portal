from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.leave import LeaveAdjustment, LeaveRequest, LeaveStatus, LeaveType
from app.models.user import Role, User
from app.schemas.leave import (
    EmployeeLeaveDetailOut,
    EmployeeLeaveSummaryOut,
    LeaveAdjustmentCreate,
    LeaveAdjustmentOut,
    LeaveApply,
    LeaveBalanceOut,
    LeaveRequestOut,
)

# Company annual leave quotas per calendar year (Jan 1 to Dec 31):
# 10 Casual Leaves + 2 Sick Leaves = 12 Total Paid Days.
# Unpaid leave has no cap.
LEAVE_QUOTAS: list[tuple[str, str, int | None]] = [
    (LeaveType.CASUAL.value, "Casual Leave", 10),
    (LeaveType.SICK.value, "Sick Leave", 2),
    (LeaveType.UNPAID.value, "Unpaid Leave", None),
]


def _require_employee(user: User) -> Employee:
    if not user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account does not have an employee profile yet.",
        )
    return user.employee


def compute_accrued_months(as_of: date, joining_date: date | None = None) -> int:
    """
    Returns number of months accrued in the calendar year of as_of.
    Each worked/active month grants 1 day of leave (up to 12 max per year).
    Joining month is included:
    Example: Joined in July (month 7), as_of November (month 11):
             July, August, September, October, November = 5 months -> 5 days accrued.
    """
    current_year = as_of.year
    start_month = 1
    if joining_date:
        if joining_date.year > current_year:
            return 0
        if joining_date.year == current_year:
            start_month = joining_date.month

    # Inclusive of both joining month and current month
    completed = as_of.month - start_month + 1
    if completed < 0:
        completed = 0
    return min(completed, 12)


def find_team_conflicts(db: Session, req: LeaveRequest) -> list[str]:
    """
    Find other employees in the same department or under the same manager
    who have approved or pending leaves that overlap with this request.
    """
    emp = req.employee
    if not emp:
        return []

    conds = []
    if emp.department_id:
        conds.append(Employee.department_id == emp.department_id)
    if emp.manager_id:
        conds.append(Employee.manager_id == emp.manager_id)

    if not conds:
        return []

    query = (
        select(LeaveRequest)
        .join(LeaveRequest.employee)
        .options(joinedload(LeaveRequest.employee))
        .where(
            LeaveRequest.id != req.id,
            LeaveRequest.employee_id != emp.id,
            LeaveRequest.status.in_([LeaveStatus.PENDING.value, LeaveStatus.APPROVED.value]),
            LeaveRequest.start_date <= req.end_date,
            LeaveRequest.end_date >= req.start_date,
            or_(*conds),
        )
    )

    conflicts = list(db.scalars(query).all())
    results: list[str] = []
    for c in conflicts:
        status_label = "Approved" if c.status == LeaveStatus.APPROVED.value else "Pending"
        results.append(
            f"{c.employee.name} ({c.employee.employee_code}) · {c.start_date} to {c.end_date} [{status_label}]"
        )
    return results


def to_leave_out(req: LeaveRequest, db: Session | None = None) -> LeaveRequestOut:
    conflicts: list[str] = []
    if db:
        conflicts = find_team_conflicts(db, req)

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
        requires_hr_approval=(req.days >= 3),
        team_conflicts=conflicts,
    )


def _base_leave_query():
    return select(LeaveRequest).options(
        joinedload(LeaveRequest.employee).joinedload(Employee.department),
        joinedload(LeaveRequest.reviewed_by),
    )


def get_balances_for_employee(
    db: Session,
    employee_id: int,
    year: int | None = None,
    as_of: date | None = None,
) -> list[LeaveBalanceOut]:
    check_date = as_of or date.today()
    target_year = year or check_date.year
    year_start = date(target_year, 1, 1)
    year_end = date(target_year, 12, 31)

    emp = db.scalar(select(Employee).where(Employee.id == employee_id))
    joining_date = emp.joining_date if emp else None

    # Accrued months in target year as of check_date
    accrued_months = compute_accrued_months(check_date, joining_date)

    # Fetch HR manual adjustments for this year
    adj_rows = list(
        db.scalars(
            select(LeaveAdjustment).where(
                LeaveAdjustment.employee_id == employee_id,
                LeaveAdjustment.year == target_year,
            )
        ).all()
    )
    total_adjustments = sum(a.days for a in adj_rows)

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

    # Paid leaves (Casual + Sick) share the monthly accrued pool + adjustments
    total_paid_used = used_by_type.get("casual", 0) + used_by_type.get("sick", 0)
    total_paid_pending = pending_by_type.get("casual", 0) + pending_by_type.get("sick", 0)
    available_accrued_pool = max(accrued_months + total_adjustments - total_paid_used - total_paid_pending, 0)

    balances: list[LeaveBalanceOut] = []
    for ltype, label, allocated in LEAVE_QUOTAS:
        used = used_by_type.get(ltype, 0)
        pending = pending_by_type.get(ltype, 0)

        if allocated is None:
            # Unpaid leave has no cap
            available = None
            accrued = None
            adj = 0
        else:
            adj = total_adjustments if ltype == "casual" else 0
            remaining_under_annual_cap = max((allocated + adj) - used - pending, 0)
            available = min(available_accrued_pool, remaining_under_annual_cap)
            accrued = accrued_months

        balances.append(
            LeaveBalanceOut(
                leave_type=ltype,
                label=label,
                allocated=allocated,
                accrued=accrued,
                adjustments=adj,
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

    # Check overlapping pending/approved requests for the same employee
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

    # Check balance based on accrual up to the requested leave date
    balances = {
        b.leave_type: b
        for b in get_balances_for_employee(
            db,
            emp.id,
            year=payload.start_date.year,
            as_of=payload.start_date,
        )
    }
    bal = balances.get(payload.leave_type)
    if bal and bal.available is not None and days > bal.available:
        accrued_info = f" (Accrued so far: {bal.accrued} day(s), available: {bal.available} day(s))."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient {bal.label} balance{accrued_info}",
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

    # Rule: > 2 days (3 or more days) requires HR Admin approval only!
    if req.days >= 3 and user.role != Role.HR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leave requests of 3 or more days require HR Admin approval.",
        )

    # Manager can only review direct reportees
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


def get_all_employees_leave_summary(
    db: Session,
    year: int | None = None,
) -> list[EmployeeLeaveSummaryOut]:
    target_year = year or date.today().year
    today = date.today()

    employees = list(
        db.scalars(
            select(Employee)
            .join(Employee.user)
            .where(User.is_active == True)
            .options(joinedload(Employee.department), joinedload(Employee.user))
            .order_by(Employee.name.asc())
        ).all()
    )

    summaries: list[EmployeeLeaveSummaryOut] = []
    for emp in employees:
        balances = get_balances_for_employee(db, emp.id, year=target_year, as_of=today)
        accrued = compute_accrued_months(today, emp.joining_date)

        used = sum(b.used for b in balances if b.leave_type != "unpaid")
        pending = sum(b.pending for b in balances if b.leave_type != "unpaid")
        adjustments = sum(b.adjustments for b in balances)

        cl_bal = next((b for b in balances if b.leave_type == "casual"), None)
        available = (
            cl_bal.available
            if cl_bal and cl_bal.available is not None
            else max(accrued + adjustments - used - pending, 0)
        )

        summaries.append(
            EmployeeLeaveSummaryOut(
                employee_id=emp.id,
                employee_code=emp.employee_code,
                name=emp.name,
                email=emp.user.email if emp.user else emp.email,
                department_name=emp.department.name if emp.department else "General",
                designation=emp.designation,
                avatar_url=emp.avatar_url,
                joining_date=emp.joining_date,
                accrued=accrued,
                adjustments=adjustments,
                used=used,
                pending=pending,
                available=available,
            )
        )
    return summaries


def get_employee_leave_detail(
    db: Session,
    employee_id: int,
    year: int | None = None,
) -> EmployeeLeaveDetailOut:
    target_year = year or date.today().year
    today = date.today()

    emp = db.scalar(
        select(Employee)
        .where(Employee.id == employee_id)
        .options(joinedload(Employee.department), joinedload(Employee.user))
    )
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    balances = get_balances_for_employee(db, emp.id, year=target_year, as_of=today)
    accrued = compute_accrued_months(today, emp.joining_date)
    used = sum(b.used for b in balances if b.leave_type != "unpaid")
    pending = sum(b.pending for b in balances if b.leave_type != "unpaid")
    adjustments_sum = sum(b.adjustments for b in balances)

    cl_bal = next((b for b in balances if b.leave_type == "casual"), None)
    available = (
        cl_bal.available
        if cl_bal and cl_bal.available is not None
        else max(accrued + adjustments_sum - used - pending, 0)
    )

    summary = EmployeeLeaveSummaryOut(
        employee_id=emp.id,
        employee_code=emp.employee_code,
        name=emp.name,
        email=emp.user.email if emp.user else emp.email,
        department_name=emp.department.name if emp.department else "General",
        designation=emp.designation,
        avatar_url=emp.avatar_url,
        joining_date=emp.joining_date,
        accrued=accrued,
        adjustments=adjustments_sum,
        used=used,
        pending=pending,
        available=available,
    )

    adj_records = list(
        db.scalars(
            select(LeaveAdjustment)
            .where(
                LeaveAdjustment.employee_id == employee_id,
                LeaveAdjustment.year == target_year,
            )
            .options(joinedload(LeaveAdjustment.adjusted_by))
            .order_by(LeaveAdjustment.created_at.desc())
        ).all()
    )
    adj_outs: list[LeaveAdjustmentOut] = [
        LeaveAdjustmentOut(
            id=a.id,
            employee_id=a.employee_id,
            year=a.year,
            leave_type=a.leave_type,
            days=a.days,
            reason=a.reason,
            adjusted_by_id=a.adjusted_by_id,
            adjusted_by_name=(
                a.adjusted_by.name or a.adjusted_by.email
                if a.adjusted_by
                else None
            ),
            created_at=a.created_at,
        )
        for a in adj_records
    ]

    recent_leaves = list(
        db.scalars(
            _base_leave_query()
            .where(LeaveRequest.employee_id == employee_id)
            .order_by(LeaveRequest.start_date.desc())
            .limit(20)
        ).all()
    )
    leave_outs = [to_leave_out(lr, db=db) for lr in recent_leaves]

    return EmployeeLeaveDetailOut(
        summary=summary,
        balances=balances,
        adjustments=adj_outs,
        recent_leaves=leave_outs,
    )


def create_leave_adjustment(
    db: Session,
    employee_id: int,
    payload: LeaveAdjustmentCreate,
    current_user: User,
) -> LeaveAdjustmentOut:
    if current_user.role != Role.HR.value and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR Admin can adjust employee leave balances.",
        )

    emp = db.scalar(select(Employee).where(Employee.id == employee_id))
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    adj_year = payload.year or date.today().year

    adjustment = LeaveAdjustment(
        employee_id=employee_id,
        year=adj_year,
        leave_type=payload.leave_type,
        days=payload.days,
        reason=payload.reason.strip(),
        adjusted_by_id=current_user.id,
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    return LeaveAdjustmentOut(
        id=adjustment.id,
        employee_id=adjustment.employee_id,
        year=adjustment.year,
        leave_type=adjustment.leave_type,
        days=adjustment.days,
        reason=adjustment.reason,
        adjusted_by_id=current_user.id,
        adjusted_by_name=current_user.name or current_user.email,
        created_at=adjustment.created_at,
    )
