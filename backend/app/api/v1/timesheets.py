from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_roles
from app.db.session import get_db
from app.models.employee import Employee
from app.models.user import Role, User
from app.schemas.timesheet import TimesheetEntryOut, TimesheetEntryUpsert
from app.services.timesheet_export_service import generate_timesheet_excel
from app.services.timesheet_service import (
    delete_timesheet,
    list_my_timesheets,
    list_team_timesheets,
    to_timesheet_out,
    upsert_timesheet,
)

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


@router.get("/my", response_model=list[TimesheetEntryOut])
def api_my_timesheets(
    month: str | None = Query(default=None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    return [to_timesheet_out(e) for e in list_my_timesheets(db, current_user, month=month)]


@router.post("", response_model=TimesheetEntryOut, status_code=status.HTTP_201_CREATED)
def api_upsert_timesheet(
    payload: TimesheetEntryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    entry = upsert_timesheet(db, current_user, payload)
    return to_timesheet_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_timesheet(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    delete_timesheet(db, current_user, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/team", response_model=list[TimesheetEntryOut])
def api_team_timesheets(
    month: str | None = Query(default=None, description="YYYY-MM"),
    employee_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MANAGER, Role.HR)),
):
    return [
        to_timesheet_out(e)
        for e in list_team_timesheets(db, current_user, month=month, employee_id=employee_id)
    ]


@router.get("/export-excel")
def api_export_timesheet_excel(
    month: str = Query(pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$", description="YYYY-MM"),
    employee_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    if month.startswith("0000-"):
        raise HTTPException(status_code=422, detail="Invalid export year.")
    target_emp_id = current_user.employee.id if current_user.employee else None
    if employee_id is not None and employee_id != target_emp_id:
        if current_user.role not in (Role.MANAGER.value, Role.HR.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot export other employee timesheet.",
            )
        employee = db.get(Employee, employee_id)
        if employee is None or (
            current_user.role == Role.MANAGER.value
            and (target_emp_id is None or employee.manager_id != target_emp_id)
        ):
            raise HTTPException(status_code=404, detail="Employee not found.")
        target_emp_id = employee_id

    if not target_emp_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No employee profile found for timesheet export.",
        )

    buf, filename = generate_timesheet_excel(db, target_emp_id, month)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


