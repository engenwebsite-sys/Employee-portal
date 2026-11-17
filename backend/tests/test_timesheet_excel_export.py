from datetime import date
import openpyxl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet import TimesheetEntry
from app.models.user import Role, User
from app.services.timesheet_export_service import generate_timesheet_excel

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def test_excel_export():
    db = Session()
    user = User(id=1, email="test@nemilink.com", password_hash="dummy_hash", role=Role.EMPLOYEE.value, is_active=True)
    db.add(user)
    db.flush()

    emp = Employee(id=1, user_id=user.id, employee_code="EMP001", name="Raja Narayanasamy", joining_date=date(2026, 1, 1), probation_end_date=date(2026, 3, 1))
    db.add(emp)
    db.flush()

    entry = TimesheetEntry(
        employee_id=emp.id,
        work_date=date(2026, 11, 2),
        login_time="09:15",
        logout_time="17:30",
        project="Maarga AI",
        task_description="=1+1",
        status="Completed",
        remarks="No blockers",
        day_type="Working Day",
    )
    db.add_all([entry, Project(name="Nemilink Project", division="Nemilink"),
                Project(name="Maarga Project", division="Maarga")])
    db.commit()

    buf, filename = generate_timesheet_excel(db, emp.id, "2026-11")
    assert filename == "Daily_Task_Nov_2026_Raja_Narayanasamy.xlsx"
    assert len(buf.getvalue()) > 5000
    workbook = openpyxl.load_workbook(buf)
    assert [cell.value for cell in workbook["Lists"]["A"][1:] if cell.value] == ["Nemilink Project"]
    assert workbook[workbook.sheetnames[0]]["F3"].data_type == "s"
    sheet = workbook.worksheets[0]
    assert [rule.formula1 for rule in sheet.data_validations.dataValidation if "E4" in rule] == ["ProjectList"]
    assert workbook.defined_names["ProjectList"].attr_text == "Lists!$A$2:$A$2"
    user.email = "test@engencbss.com"
    db.commit()
    buf, _ = generate_timesheet_excel(db, emp.id, "2026-11")
    workbook = openpyxl.load_workbook(buf)
    assert not any(cell.value for cell in workbook["Lists"]["A"][1:])
    assert not any("E4" in rule for rule in workbook.worksheets[0].data_validations.dataValidation)
    print(f"Export Excel test PASSED! Generated: {filename} ({len(buf.getvalue())} bytes)")

if __name__ == "__main__":
    test_excel_export()
