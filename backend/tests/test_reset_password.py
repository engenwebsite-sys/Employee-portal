from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date

from app.db.base import Base
from app.models.employee import Employee
from app.models.user import Role, User
from app.core.security import hash_password, verify_password
from app.api.v1.employees import api_reset_employee_password

# In-memory SQLite
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def test_reset_password_flow():
    db = Session()
    # 1. Create User and Employee
    user = User(
        id=10,
        email="john@nemilink.com",
        role=Role.EMPLOYEE.value,
        password_hash=hash_password("OldPassword@123"),
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.flush()

    emp = Employee(
        id=10,
        user_id=user.id,
        employee_code="EMP010",
        name="John Doe",
        joining_date=date(2026, 1, 1),
        probation_end_date=date(2026, 3, 1),
    )
    db.add(emp)
    db.commit()

    # 2. Reset password as HR
    hr = User(id=1, email="hr@nemilink.com", role=Role.HR.value, is_active=True)
    res = api_reset_employee_password(emp.id, db=db, _=hr)

    assert "Nemilink@" in res.temporary_password
    assert res.email == "john@nemilink.com"

    # Refresh user
    db.refresh(user)
    assert user.must_change_password is True
    assert verify_password(res.temporary_password, user.password_hash) is True
    print("ALL RESET PASSWORD TESTS PASSED!")

if __name__ == "__main__":
    test_reset_password_flow()
