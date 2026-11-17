import io
import tempfile
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.employee import Employee
from app.models.user import Role, User
from app.api.v1.me import upload_my_avatar, delete_my_avatar
from fastapi import UploadFile

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def test_avatar_sync():
    db = Session()
    user = User(id=1, email="emp@nemilink.com", password_hash="dummy", role=Role.EMPLOYEE.value, is_active=True)
    db.add(user)
    db.flush()

    emp = Employee(
        id=1,
        user_id=user.id,
        employee_code="EMP001",
        name="Test Employee",
        joining_date=date(2026, 1, 1),
        probation_end_date=date(2026, 3, 1),
    )
    db.add(emp)
    db.commit()

    # Link user.employee relationship
    user.employee = emp

    spooled = tempfile.SpooledTemporaryFile()
    spooled.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"A" * 500)
    spooled.seek(0)
    upload_file = UploadFile(file=spooled, filename="profile.jpg", headers={"content-type": "image/jpeg"})

    # Test upload
    res = upload_my_avatar(file=upload_file, db=db, current_user=user)
    assert res["employee"]["avatar_url"] is not None
    assert res["employee"]["avatar_url"].startswith("/api/v1/uploads/avatars/avatar_emp_1_")
    print(f"Avatar upload passed: {res['employee']['avatar_url']}")

    # Test delete
    res_del = delete_my_avatar(db=db, current_user=user)
    assert res_del["employee"]["avatar_url"] is None
    print("Avatar delete passed!")

if __name__ == "__main__":
    test_avatar_sync()
