import calendar
from collections import Counter
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.portal_date import portal_today
from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet import TimesheetEntry
from app.models.user import Role, User
from app.schemas.timesheet import TimesheetEntryOut, TimesheetEntryUpsert, TimesheetTask


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
    today = portal_today()
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
        tasks=timesheet_tasks(entry),
        status=entry.status,
        remarks=entry.remarks,
        day_type=entry.day_type,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def timesheet_tasks(entry: TimesheetEntry) -> list[TimesheetTask]:
    if entry.tasks is not None:
        return [TimesheetTask.model_validate(task) for task in entry.tasks]
    return [TimesheetTask(project=entry.project, task_description=entry.task_description, status=entry.status)]


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
    db.scalar(select(Employee.id).where(Employee.id == emp.id).with_for_update())
    entry = db.scalar(
        select(TimesheetEntry).where(
            TimesheetEntry.employee_id == emp.id,
            TimesheetEntry.work_date == payload.work_date,
        ).with_for_update()
    )
    if payload.tasks is not None and payload.entry_id != (entry.id if entry else None):
        raise HTTPException(status_code=409, detail="Reload this date and use Edit to update its existing timesheet.")
    if payload.tasks is not None and entry and payload.expected_updated_at != entry.updated_at:
        raise HTTPException(status_code=409, detail="This timesheet changed since you opened it. Reopen the entry and try again.")
    if payload.tasks is None and entry and entry.tasks is not None:
        raise HTTPException(status_code=409, detail="Open the current Timesheets page to edit this entry.")

    old_projects = Counter(task.project for task in timesheet_tasks(entry) if task.project) if entry else Counter()
    tasks = payload.tasks if payload.tasks is not None else [TimesheetTask(
        project=payload.project, task_description=payload.task_description, status=payload.status,
    )]
    for task in tasks:
        task.project = (task.project or "").strip() or None
        task.task_description = task.task_description.strip()
        task.status = task.status.strip() or "In Progress"
    new_projects = set(Counter(task.project for task in tasks if task.project) - old_projects)
    if new_projects:
        visible_projects = set(db.scalars(select(Project.name).where(
            Project.name.in_(new_projects), Project.status == "Active", Project.visible_to_email(user.email),
        )))
        if new_projects != visible_projects:
            raise HTTPException(status_code=422, detail="Select a project from your division.")

    if entry is None:
        entry = TimesheetEntry(employee_id=emp.id, work_date=payload.work_date)
        db.add(entry)

    entry.login_time = payload.login_time.strip() if payload.login_time else None
    entry.logout_time = payload.logout_time.strip() if payload.logout_time else None
    first_task = tasks[0] if tasks else TimesheetTask(status="N/A")
    entry.project = first_task.project
    entry.task_description = first_task.task_description
    statuses = {task.status for task in tasks} - {"N/A"}
    if "Blocked" in statuses:
        entry.status = "Blocked"
    elif len(statuses) == 1:
        entry.status = statuses.pop()
    else:
        entry.status = "In Progress" if statuses else "N/A"
    if payload.tasks is not None:
        entry.tasks = [task.model_dump() for task in tasks]
    entry.remarks = payload.remarks.strip() if payload.remarks else None
    entry.day_type = payload.day_type.strip() or "Working Day"
    entry.updated_at = datetime.now(timezone.utc)

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

