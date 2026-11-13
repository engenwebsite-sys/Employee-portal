import calendar
import io
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional

import openpyxl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet import TimesheetEntry

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "timesheet_template.xlsx"


def parse_hhmm_time(val: Optional[str]) -> Optional[time]:
    if not val or ":" not in val:
        return None
    try:
        parts = val.strip().split(":")
        h = int(parts[0])
        m = int(parts[1][:2])
        return time(h, m)
    except Exception:
        return None


def generate_timesheet_excel(
    db: Session,
    employee_id: int,
    month_str: str,
) -> tuple[io.BytesIO, str]:
    """Generates an Excel timesheet workbook populated into the official company template."""
    year, month_num = map(int, month_str.split("-"))
    num_days = calendar.monthrange(year, month_num)[1]
    month_dt = datetime(year, month_num, 1)
    month_name = month_dt.strftime("%b %Y")  # e.g. "Nov 2026"
    month_file_suffix = month_dt.strftime("%b_%Y")  # e.g. "Nov_2026"

    emp = db.get(Employee, employee_id)
    emp_name_slug = emp.name.replace(" ", "_") if emp else "Employee"

    # Query entries for this employee for the whole month
    start_date = date(year, month_num, 1)
    end_date = date(year, month_num, num_days)

    entries = list(
        db.scalars(
            select(TimesheetEntry)
            .where(
                TimesheetEntry.employee_id == employee_id,
                TimesheetEntry.work_date >= start_date,
                TimesheetEntry.work_date <= end_date,
            )
            .order_by(TimesheetEntry.work_date.asc())
        ).all()
    )
    entries_map = {e.work_date: e for e in entries}

    # Load workbook from template
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found at {TEMPLATE_PATH}")

    wb = openpyxl.load_workbook(TEMPLATE_PATH)

    # 1. Update Sheet 1 Title
    ws = wb[wb.sheetnames[0]]
    ws.title = month_name

    # 2. Update dynamic project suggestions in 'Lists' sheet if present
    if "Lists" in wb.sheetnames:
        ws_lists = wb["Lists"]
        active_projects = list(
            db.scalars(
                select(Project.name).where(Project.status == "Active").order_by(Project.name.asc())
            ).all()
        )
        if active_projects:
            # Clear old rows in column A (from row 2 down) and write current active projects
            for r in range(2, 50):
                ws_lists[f"A{r}"].value = None
            for idx, p_name in enumerate(active_projects, start=2):
                ws_lists[f"A{idx}"].value = p_name

    # 3. Populate rows 2 .. num_days + 1
    for day in range(1, num_days + 1):
        row_idx = day + 1
        curr_date = date(year, month_num, day)

        # Date & Day
        ws[f"A{row_idx}"] = curr_date
        ws[f"A{row_idx}"].number_format = "dd-mmm-yy"
        ws[f"B{row_idx}"] = curr_date.strftime("%a")

        entry = entries_map.get(curr_date)
        if entry:
            t_login = parse_hhmm_time(entry.login_time)
            if t_login:
                ws[f"C{row_idx}"] = t_login
                ws[f"C{row_idx}"].number_format = "hh:mm AM/PM"

            t_logout = parse_hhmm_time(entry.logout_time)
            if t_logout:
                ws[f"D{row_idx}"] = t_logout
                ws[f"D{row_idx}"].number_format = "hh:mm AM/PM"

            ws[f"E{row_idx}"] = entry.project or ""
            ws[f"F{row_idx}"] = entry.task_description or ""
            ws[f"G{row_idx}"] = entry.status or ""
            ws[f"H{row_idx}"] = entry.remarks or ""
            ws[f"I{row_idx}"] = entry.day_type or (
                "Week Off" if curr_date.weekday() in (5, 6) else "Working Day"
            )
        else:
            if curr_date.weekday() in (5, 6):
                ws[f"I{row_idx}"] = "Week Off"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"Daily_Task_{month_file_suffix}_{emp_name_slug}.xlsx"
    return buf, filename

