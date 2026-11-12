from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.employee import Department
from app.models.user import Role, User
from app.schemas.employee import (
    DepartmentCreate,
    DepartmentOut,
    EmployeeCreate,
    EmployeeOut,
    EmployeeUpdate,
)
from app.services.employee_service import (
    create_employee,
    get_employee_or_404,
    get_team_for_manager,
    list_employees,
    to_employee_out_dict,
    update_employee,
)

router = APIRouter(tags=["Employees"])


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list(db.scalars(select(Department).order_by(Department.name.asc())).all())


@router.post(
    "/departments",
    response_model=DepartmentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR)),
):
    clean = payload.name.strip()
    existing = db.scalar(select(Department).where(Department.name.ilike(clean)))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Department already exists.",
        )
    dept = Department(name=clean)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/employees", response_model=list[EmployeeOut])
def api_list_employees(
    search: str | None = Query(default=None),
    department_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR)),
):
    emps = list_employees(db, search=search, department_id=department_id)
    return [to_employee_out_dict(e) for e in emps]


@router.post(
    "/employees",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED,
)
def api_create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR)),
):
    emp = create_employee(db, payload)
    return to_employee_out_dict(emp)


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
def api_get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.HR, Role.MANAGER)),
):
    emp = get_employee_or_404(db, employee_id)
    if current_user.role == Role.MANAGER.value:
        my_emp_id = current_user.employee.id if current_user.employee else None
        if emp.manager_id != my_emp_id and emp.id != my_emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only view their own direct reportees.",
            )
    return to_employee_out_dict(emp)


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
def api_update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR)),
):
    emp = update_employee(db, employee_id, payload)
    return to_employee_out_dict(emp)


@router.get("/manager/team", response_model=list[EmployeeOut])
def api_manager_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    emps = get_team_for_manager(db, current_user)
    return [to_employee_out_dict(e) for e in emps]