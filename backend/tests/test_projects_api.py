from datetime import date

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.projects import create_project, delete_project, get_project, list_projects, update_project
from app.db.base import Base
from app.models.employee import Employee
from app.models.project import Project
from app.models.user import Role, User
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.timesheet import TimesheetEntryUpsert
from app.services.timesheet_service import upsert_timesheet

# In-memory SQLite engine
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def test_projects_and_division_access():
    db = Session()
    user = User(id=1, email="hr@nemilink.com", role=Role.HR.value, is_active=True)

    # 1. Initial list
    res = list_projects(None, None, db=db, _=user)
    assert len(res) == 0

    # 2. Create project
    p1 = create_project(ProjectCreate(name="Maarga AI", code="MAI", client="Maarga"), db=db, _=user)
    assert p1.id is not None
    assert p1.name == "Maarga AI"
    assert p1.code == "MAI"

    # 3. Duplicate rejection
    try:
        create_project(ProjectCreate(name="Maarga AI", code="MAI2"), db=db, _=user)
        assert False, "Should have raised 409"
    except HTTPException as e:
        assert e.status_code == 409

    # 4. Update project
    p1_up = update_project(p1.id, ProjectUpdate(client="Maarga Technologies", status="Active"), db=db, _=user)
    assert p1_up.client == "Maarga Technologies"

    # 5. List with filter
    res = list_projects("Active", None, db=db, _=user)
    assert len(res) == 1
    assert res[0].name == "Maarga AI"

    # 6. Delete project
    delete_project(p1.id, db=db, _=user)
    res_after = list_projects(None, None, db=db, _=user)
    assert len(res_after) == 0
    db.close()

    check_division_access()

    print("ALL PROJECT BACKEND TESTS PASSED SUCCESSFULLY!")


def check_division_access():
    user = User(email="hr@engencbss.com", role=Role.HR.value, must_change_password=False)
    user.employee = Employee(
        id=1,
        employee_code="EMP001",
        name="Test Employee",
        joining_date=date(2025, 1, 1),
        probation_end_date=date(2025, 4, 1),
    )
    with Session() as db:
        db.add(Project(name="Legacy"))
        db.commit()
        create_project(ProjectCreate(name="Maarga project", division="Maarga"), db, user)
        nemilink = create_project(ProjectCreate(name="Nemilink project", division="Nemilink"), db, user)
        assert list_projects("Active", None, db, user) == []

        managed = {project.name: project for project in list_projects(None, None, db, user, manage=True)}
        assert len(managed) == 3
        assert managed["Legacy"].division is None
        legacy_id = managed["Legacy"].id
        assigned = update_project(legacy_id, ProjectUpdate(division="Maarga"), db, user)
        assert assigned.division == "Maarga"

        user.email = "manager@maargaai.com"
        user.role = Role.MANAGER.value
        assert {p.name for p in list_projects(None, None, db, user, manage=True)} == {"Legacy", "Maarga project"}
        nemilink_id = nemilink.id
        assert_status(404, get_project, nemilink_id, db, user)
        assert_status(404, update_project, nemilink_id, ProjectUpdate(status="Archived"), db, user)
        assert_status(403, update_project, legacy_id, ProjectUpdate(division="Nemilink"), db, user)
        assert_status(403, create_project, ProjectCreate(name="Other division", division="Nemilink"), db, user)

        user.email = "employee@nemilink.com"
        user.role = Role.EMPLOYEE.value
        assert [p.name for p in list_projects("Active", None, db, user)] == ["Nemilink project"]
        quick_add = create_project(ProjectCreate(name="Quick add project"), db, user)
        assert quick_add.division == "Nemilink"

        entry = TimesheetEntryUpsert(work_date=date(2026, 11, 16), project="Maarga project")
        assert_status(422, upsert_timesheet, db, user, entry)
        entry.project = "Nemilink project"
        assert upsert_timesheet(db, user, entry).project == entry.project

        user.role = Role.HR.value
        update_project(nemilink_id, ProjectUpdate(division="Maarga"), db, user)
        user.role = Role.EMPLOYEE.value
        entry.remarks = "Updated historical entry"
        assert upsert_timesheet(db, user, entry).remarks == entry.remarks


def assert_status(status, operation, *args):
    try:
        operation(*args)
    except HTTPException as exc:
        assert exc.status_code == status
    else:
        raise AssertionError(f"Expected {operation.__name__} to return status {status}")

if __name__ == "__main__":
    test_projects_and_division_access()
