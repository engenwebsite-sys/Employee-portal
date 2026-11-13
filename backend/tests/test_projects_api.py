from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.project import Project
from app.models.user import Role, User
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.api.v1.projects import list_projects, create_project, update_project, delete_project
from fastapi import HTTPException

# In-memory SQLite engine
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def run_tests():
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

    print("ALL PROJECT BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
