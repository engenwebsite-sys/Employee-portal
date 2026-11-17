from datetime import date
from io import BytesIO

import openpyxl
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Employee, Project, User
from tests.conftest import auth, login, make_user


def test_daily_timesheet_preserves_existing_tasks_and_exports_each_task(client):
    email = "timesheet-tasks@nemilink.com"
    make_user(email, "employee")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        db.add(Employee(
            user_id=user.id, employee_code="TASK-01", name="Timesheet Tasks",
            joining_date=date(2026, 1, 1), probation_end_date=date(2026, 3, 1),
        ))
        db.add_all([
            Project(name="Task test project A", division="Nemilink"),
            Project(name="Task test project B", division="Nemilink"),
            Project(name="Task test restricted", division="Maarga"),
        ])
        db.commit()

    headers = auth(login(client, email).json())
    api = "/api/v1/timesheets"
    day = {"work_date": "2026-11-17", "login_time": "09:15", "logout_time": "17:30"}
    legacy = client.post(api, headers=headers, json={
        **day, "project": "Task test project A", "task_description": "Existing task",
    })
    assert legacy.status_code == 201
    existing = legacy.json()
    tasks = existing["tasks"] + [{
        "project": "Task test project B", "task_description": "Second project",
        "status": "Completed", "duration_minutes": 90,
    }]
    update = {**day, "entry_id": existing["id"], "expected_updated_at": existing["updated_at"], "tasks": tasks}
    assert client.post(api, headers=headers, json={**day, "tasks": tasks}).status_code == 409
    restricted = {**tasks[1], "project": "Task test restricted"}
    assert client.post(api, headers=headers, json={**update, "tasks": [tasks[0], restricted]}).status_code == 422
    saved = client.post(api, headers=headers, json=update)
    assert saved.status_code == 201
    assert saved.json()["tasks"] == tasks
    assert client.post(api, headers=headers, json=update).status_code == 409
    assert client.post(api, headers=headers, json=day).status_code == 409
    rows = client.get(f"{api}/my?month=2026-11", headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["id"] == existing["id"]
    assert rows[0]["tasks"] == tasks

    exported = client.get(f"{api}/export-excel?month=2026-11", headers=headers)
    assert exported.status_code == 200
    sheet = openpyxl.load_workbook(BytesIO(exported.content))["Task Details"]
    assert sheet["C2"].value == "Existing task"
    assert sheet["C3"].value == "Second project"
    assert sheet["E3"].value == 90
