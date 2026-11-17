import calendar
import io
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional

import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet import TimesheetEntry
from app.services.timesheet_service import timesheet_tasks

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


def _write_text(cell, value: str | None) -> None:
    cell.value = value or ""
    cell.data_type = "s"


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
        for cell in ws_lists["A"][1:]:
            cell.value = None
        active_projects = []
        if emp:
            active_projects = db.scalars(
                select(Project.name)
                .where(Project.status == "Active", Project.visible_to_email(emp.email))
                .order_by(Project.name.asc())
            ).all()
        for idx, name in enumerate(active_projects, start=2):
            _write_text(ws_lists[f"A{idx}"], name)

        project_validations = ws.data_validations.dataValidation
        project_validations[:] = [
            validation for validation in project_validations
            if validation.formula1 != "ProjectList" and "E4" not in validation
        ]
        wb.defined_names["ProjectList"].attr_text = f"Lists!$A$2:$A${max(2, len(active_projects) + 1)}"
        if active_projects:
            dropdown = DataValidation(type="list", formula1="ProjectList", allow_blank=True)
            ws.add_data_validation(dropdown)
            dropdown.add(f"E2:E{num_days + 1}")

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

            _write_text(ws[f"E{row_idx}"], entry.project)
            _write_text(ws[f"F{row_idx}"], entry.task_description)
            _write_text(ws[f"G{row_idx}"], entry.status)
            _write_text(ws[f"H{row_idx}"], entry.remarks)
            day_type = entry.day_type or ("Week Off" if curr_date.weekday() in (5, 6) else "Working Day")
            _write_text(ws[f"I{row_idx}"], day_type)
        else:
            if curr_date.weekday() in (5, 6):
                ws[f"I{row_idx}"] = "Week Off"

    task_sheet = wb.create_sheet("Task Details")
    task_sheet.append(["Date", "Project", "Task Description", "Status", "Time Spent (minutes)"])
    task_sheet.freeze_panes = "A2"
    for column, width in {"A": 15, "B": 30, "C": 60, "D": 18, "E": 24}.items():
        task_sheet.column_dimensions[column].width = width
    row_number = 2
    for entry in entries:
        for task in timesheet_tasks(entry):
            task_sheet.cell(row_number, 1, entry.work_date).number_format = "dd-mmm-yy"
            _write_text(task_sheet.cell(row_number, 2), task.project)
            _write_text(task_sheet.cell(row_number, 3), task.task_description)
            _write_text(task_sheet.cell(row_number, 4), task.status)
            task_sheet.cell(row_number, 5, task.duration_minutes)
            row_number += 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"Daily_Task_{month_file_suffix}_{emp_name_slug}.xlsx"
    return buf, filename

