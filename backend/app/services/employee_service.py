import calendar
from datetime import date
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.employee import Department, Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, SelfProfileUpdate


def add_two_months(d: date) -> date:
    """Default probation end date: 2 calendar months after joining_date."""
    month = d.month - 1 + 2
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def to_employee_out_dict(emp: Employee) -> dict:
    return {
        "id": emp.id,
        "user_id": emp.user_id,
        "email": emp.user.email,
        "role": emp.user.role,
        "is_active": emp.user.is_active,
        "employee_code": emp.employee_code,
        "name": emp.name,
        "department": emp.department,
        "designation": emp.designation,
        "manager": emp.manager,
        "joining_date": emp.joining_date,
        "probation_end_date": emp.probation_end_date,
        "phone": emp.phone,
        "emergency_contact": emp.emergency_contact,
        "created_at": emp.created_at,
    }


def _validate_department(db: Session, department_id: int | None) -> None:
    if department_id is not None:
        dept = db.get(Department, department_id)
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )


def _validate_manager(db: Session, manager_id: int | None, employee_id: int | None = None) -> None:
    if manager_id is None:
        return
    if employee_id is not None and manager_id == employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An employee cannot be their own manager.",
        )
    mgr = db.get(Employee, manager_id)
    if not mgr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected manager not found.",
        )
    if employee_id is not None:
        # Prevent circular reporting chains (A -> B -> A)
        visited = {employee_id}
        curr = mgr
        while curr is not None:
            if curr.id in visited:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Circular manager hierarchy is not allowed.",
                )
            visited.add(curr.id)
            curr = db.get(Employee, curr.manager_id) if curr.manager_id else None


def list_employees(db: Session, search: str | None = None, department_id: int | None = None) -> list[Employee]:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.user),
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .order_by(Employee.employee_code.asc())
    )
    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.join(Employee.user).where(
            (Employee.name.ilike(pattern))
            | (Employee.employee_code.ilike(pattern))
            | (User.email.ilike(pattern))
        )
    return list(db.scalars(stmt).unique().all())


def get_employee_or_404(db: Session, employee_id: int) -> Employee:
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.user),
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .where(Employee.id == employee_id)
    )
    emp = db.scalars(stmt).unique().first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return emp


def create_employee(db: Session, payload: EmployeeCreate) -> Employee:
    email_lower = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email_lower)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    code_clean = payload.employee_code.strip().upper()
    if db.scalar(select(Employee).where(Employee.employee_code == code_clean)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee code is already in use.",
        )

    _validate_department(db, payload.department_id)
    _validate_manager(db, payload.manager_id)

    user = User(
        email=email_lower,
        password_hash=hash_password(payload.temporary_password),
        role=payload.role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    probation_end = payload.probation_end_date or add_two_months(payload.joining_date)
    emp = Employee(
        user_id=user.id,
        employee_code=code_clean,
        name=payload.name.strip(),
        department_id=payload.department_id,
        designation=payload.designation.strip() if payload.designation else None,
        manager_id=payload.manager_id,
        joining_date=payload.joining_date,
        probation_end_date=probation_end,
        phone=payload.phone.strip() if payload.phone else None,
        emergency_contact=payload.emergency_contact.strip() if payload.emergency_contact else None,
    )
    db.add(emp)
    db.commit()
    return get_employee_or_404(db, emp.id)


def update_employee(db: Session, employee_id: int, payload: EmployeeUpdate) -> Employee:
    emp = get_employee_or_404(db, employee_id)
    data = payload.model_dump(exclude_unset=True)

    if "department_id" in data:
        _validate_department(db, data["department_id"])
        emp.department_id = data["department_id"]

    if "manager_id" in data:
        _validate_manager(db, data["manager_id"], employee_id=emp.id)
        emp.manager_id = data["manager_id"]

    if "role" in data and data["role"] is not None:
        emp.user.role = data["role"]

    if "is_active" in data and data["is_active"] is not None:
        emp.user.is_active = data["is_active"]

    if "name" in data and data["name"] is not None:
        emp.name = data["name"].strip()

    if "designation" in data:
        emp.designation = data["designation"].strip() if data["designation"] else None

    if "probation_end_date" in data and data["probation_end_date"] is not None:
        emp.probation_end_date = data["probation_end_date"]

    if "phone" in data:
        emp.phone = data["phone"].strip() if data["phone"] else None

    if "emergency_contact" in data:
        emp.emergency_contact = data["emergency_contact"].strip() if data["emergency_contact"] else None

    db.commit()
    return get_employee_or_404(db, emp.id)


def update_self_profile(db: Session, user: User, payload: SelfProfileUpdate) -> Employee:
    if not user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked to this account.",
        )
    data = payload.model_dump(exclude_unset=True)
    if "phone" in data:
        user.employee.phone = data["phone"].strip() if data["phone"] else None
    if "emergency_contact" in data:
        user.employee.emergency_contact = (
            data["emergency_contact"].strip() if data["emergency_contact"] else None
        )
    db.commit()
    return get_employee_or_404(db, user.employee.id)


def get_team_for_manager(db: Session, manager_user: User) -> list[Employee]:
    if not manager_user.employee:
        return []
    stmt = (
        select(Employee)
        .options(
            joinedload(Employee.user),
            joinedload(Employee.department),
            joinedload(Employee.manager),
        )
        .where(Employee.manager_id == manager_user.employee.id)
        .order_by(Employee.employee_code.asc())
    )
    return list(db.scalars(stmt).unique().all())