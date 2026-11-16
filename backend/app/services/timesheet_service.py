import calendar
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet import TimesheetEntry
from app.models.user import Role, User
from app.schemas.timesheet import TimesheetEntryOut, TimesheetEntryUpsert


def _require_employee(user: User) -> Employee:
    if not user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account does not have an employee profile yet.",
        )
    return user.employee


def _month_bounds(month: str | None) -> tuple[date, date]:
    if month:
        try:
            year_s, mon_s = month.split("-")
            year, mon = int(year_s), int(mon_s)
            last_day = calendar.monthrange(year, mon)[1]
            return date(year, mon, 1), date(year, mon, last_day)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Month must be in YYYY-MM format.",
            ) from exc
    today = date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    return date(today.year, today.month, 1), date(today.year, today.month, last_day)


def _base_query():
    return select(TimesheetEntry).options(
        joinedload(TimesheetEntry.employee).joinedload(Employee.department)
    )


def to_timesheet_out(entry: TimesheetEntry) -> TimesheetEntryOut:
    return TimesheetEntryOut(
        id=entry.id,
        employee_id=entry.employee_id,
        employee_code=entry.employee.employee_code,
        employee_name=entry.employee.name,
        department_name=entry.employee.department.name if entry.employee.department else None,
        work_date=entry.work_date,
        login_time=entry.login_time,
        logout_time=entry.logout_time,
        project=entry.project,
        task_description=entry.task_description,
        status=entry.status,
        remarks=entry.remarks,
        day_type=entry.day_type,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def list_my_timesheets(db: Session, user: User, month: str | None = None) -> list[TimesheetEntry]:
    emp = _require_employee(user)
    start, end = _month_bounds(month)
    return list(
        db.scalars(
            _base_query()
            .where(
                TimesheetEntry.employee_id == emp.id,
                TimesheetEntry.work_date >= start,
                TimesheetEntry.work_date <= end,
            )
            .order_by(TimesheetEntry.work_date.desc())
        ).all()
    )


def upsert_timesheet(db: Session, user: User, payload: TimesheetEntryUpsert) -> TimesheetEntry:
    emp = _require_employee(user)
    entry = db.scalar(
        select(TimesheetEntry).where(
            TimesheetEntry.employee_id == emp.id,
            TimesheetEntry.work_date == payload.work_date,
        )
    )
    project_name = (payload.project or "").strip() or None
    if project_name and (entry is None or project_name != entry.project):
        project_id = db.scalar(
            select(Project.id).where(
                Project.name == project_name,
                Project.status == "Active",
                Project.visible_to_email(user.email),
            )
        )
        if project_id is None:
            raise HTTPException(status_code=422, detail="Select a project from your division.")

    if entry is None:
        entry = TimesheetEntry(employee_id=emp.id, work_date=payload.work_date)
        db.add(entry)

    entry.login_time = payload.login_time.strip() if payload.login_time else None
    entry.logout_time = payload.logout_time.strip() if payload.logout_time else None
    entry.project = project_name
    entry.task_description = payload.task_description.strip()
    entry.status = payload.status.strip() or "In Progress"
    entry.remarks = payload.remarks.strip() if payload.remarks else None
    entry.day_type = payload.day_type.strip() or "Working Day"

    db.commit()
    return db.scalar(_base_query().where(TimesheetEntry.id == entry.id))


def delete_timesheet(db: Session, user: User, entry_id: int) -> None:
    emp = _require_employee(user)
    entry = db.scalar(select(TimesheetEntry).where(TimesheetEntry.id == entry_id))
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timesheet entry not found.")
    if entry.employee_id != emp.id and user.role != Role.HR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own timesheet entries.",
        )
    db.delete(entry)
    db.commit()


def list_team_timesheets(
    db: Session,
    user: User,
    month: str | None = None,
    employee_id: int | None = None,
) -> list[TimesheetEntry]:
    start, end = _month_bounds(month)
    query = _base_query().where(
        TimesheetEntry.work_date >= start,
        TimesheetEntry.work_date <= end,
    )
    if user.role == Role.MANAGER.value:
        my_emp_id = user.employee.id if user.employee else -1
        query = query.join(TimesheetEntry.employee).where(Employee.manager_id == my_emp_id)
    if employee_id is not None:
        query = query.where(TimesheetEntry.employee_id == employee_id)

    return list(
        db.scalars(
            query.order_by(TimesheetEntry.work_date.desc(), TimesheetEntry.employee_id.asc())
        ).all()
    )

