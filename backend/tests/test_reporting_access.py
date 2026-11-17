from datetime import date

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Department, Employee, User
from app.models.leave import LeaveRequest, LeaveStatus

from .conftest import auth, login, make_user


def test_managers_only_report_on_direct_reports(client):
    roles = {"manager": "manager", "report": "employee", "outside": "employee", "hr": "hr"}
    ids = {}
    with SessionLocal() as db:
        department = Department(name="Reporting test department")
        db.add(department)
        db.flush()
        for name, role in roles.items():
            email = f"{name}@nemilink.com"
            make_user(email, role)
            user = db.scalar(select(User).where(User.email == email))
            employee = Employee(
                user_id=user.id, employee_code=name, name=name,
                joining_date=date(2025, 1, 1), probation_end_date=date(2025, 3, 1),
                department_id=department.id,
                manager_id=ids.get("manager") if name == "report" else None,
            )
            db.add(employee)
            db.flush()
            ids[name] = employee.id

        db.add(LeaveRequest(
            employee_id=ids["report"], leave_type="casual", reason="Year-end leave",
            start_date=date(2025, 12, 31), end_date=date(2026, 1, 1),
            days=2, status=LeaveStatus.APPROVED.value,
        ))
        db.add(LeaveRequest(
            employee_id=ids["outside"], leave_type="unpaid", reason="Overlapping leave",
            start_date=date(2026, 1, 1), end_date=date(2026, 1, 1),
            days=1, status=LeaveStatus.APPROVED.value,
        ))
        db.commit()

    manager = auth(login(client, "manager@nemilink.com").json())
    hr = auth(login(client, "hr@nemilink.com").json())
    employee = auth(login(client, "report@nemilink.com").json())
    summary = "/api/v1/leaves/employees-summary"
    detail = "/api/v1/leaves/employees"
    export = "/api/v1/timesheets/export-excel?month=2026-01"

    reports = client.get(summary, headers=manager)
    assert reports.status_code == 200
    assert [row["employee_id"] for row in reports.json()] == [ids["report"]]
    assert len(client.get(summary, headers=hr).json()) == 4
    for year in (2025, 2026):
        result = client.get(f"{detail}/{ids['report']}/detail?year={year}", headers=manager)
        assert result.status_code == 200
        assert result.json()["summary"]["used"] == 1
    assert client.get(f"{detail}/{ids['outside']}/detail", headers=manager).status_code == 404
    assert client.get(f"{detail}/{ids['outside']}/detail", headers=hr).status_code == 200
    assert client.get(f"{export}&employee_id={ids['report']}", headers=manager).status_code == 200
    assert client.get(f"{export}&employee_id={ids['outside']}", headers=manager).status_code == 404
    assert client.get(f"{export}&employee_id={ids['outside']}", headers=hr).status_code == 200
    assert client.get(f"{export}&employee_id={ids['outside']}", headers=employee).status_code == 403

    personal = client.get("/api/v1/leaves/my", headers=employee).json()[0]
    assert personal["team_conflict_count"] == 1
    assert personal["team_conflicts"] == []
    assert client.get("/api/v1/leaves/approvals", headers=manager).json()[0]["team_conflicts"] == []
    approver_rows = client.get("/api/v1/leaves/approvals", headers=hr).json()
    assert all(row["team_conflicts"] for row in approver_rows)

    adjustment = client.post(f"{detail}/{ids['report']}/adjust", headers=hr, json={
        "leave_type": "sick", "year": 2025, "days": 2, "reason": "Correct sick quota",
    })
    assert adjustment.status_code == 201
    result = client.get(f"{detail}/{ids['report']}/detail?year=2025", headers=hr)
    balances = {row["leave_type"]: row for row in result.json()["balances"]}
    assert balances["sick"]["available"] == 4
    assert balances["sick"]["adjustments"] == 2
    assert balances["casual"]["adjustments"] == 0
