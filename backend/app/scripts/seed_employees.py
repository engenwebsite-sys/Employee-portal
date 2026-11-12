from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.employee import Department, Employee
from app.models.user import Role, User
from app.services.employee_service import add_two_months


def get_or_create_dept(db: Session, name: str) -> Department:
    dept = db.scalar(select(Department).where(Department.name == name))
    if not dept:
        dept = Department(name=name)
        db.add(dept)
        db.flush()
    return dept


def get_or_create_user(db: Session, email: str, role: str, password: str = "Welcome@123") -> User:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(password),
            role=role,
            is_active=True,
            must_change_password=False,
        )
        db.add(user)
        db.flush()
    return user


def run() -> None:
    db = SessionLocal()
    try:
        hr_dept = get_or_create_dept(db, "Human Resources")
        eng_dept = get_or_create_dept(db, "Engineering")
        ops_dept = get_or_create_dept(db, "Operations")

        hr_user = get_or_create_user(db, "hr@nemilink.com", Role.HR.value)
        mgr_user = get_or_create_user(db, "manager@nemilink.com", Role.MANAGER.value)
        emp_user = get_or_create_user(db, "employee@nemilink.com", Role.EMPLOYEE.value)

        # 1. HR Profile (Top of reporting chain)
        hr_emp = db.scalar(select(Employee).where(Employee.user_id == hr_user.id))
        if not hr_emp:
            join_d = date(2025, 1, 10)
            hr_emp = Employee(
                user_id=hr_user.id,
                employee_code="EMP001",
                name="Siva Chandran",
                department_id=hr_dept.id,
                designation="HR Lead",
                manager_id=None,
                joining_date=join_d,
                probation_end_date=add_two_months(join_d),
                phone="9876543210",
                emergency_contact="Sundaram - 9876500001",
            )
            db.add(hr_emp)
            db.flush()

        # 2. Manager Profile (Reports to HR)
        mgr_emp = db.scalar(select(Employee).where(Employee.user_id == mgr_user.id))
        if not mgr_emp:
            join_d = date(2025, 3, 15)
            mgr_emp = Employee(
                user_id=mgr_user.id,
                employee_code="EMP002",
                name="Karthik Rajan",
                department_id=eng_dept.id,
                designation="Engineering Manager",
                manager_id=hr_emp.id,
                joining_date=join_d,
                probation_end_date=add_two_months(join_d),
                phone="9876543211",
                emergency_contact="Rajan - 9876500002",
            )
            db.add(mgr_emp)
            db.flush()

        # 3. Employee Profile (Reports to Manager)
        emp_emp = db.scalar(select(Employee).where(Employee.user_id == emp_user.id))
        if not emp_emp:
            join_d = date(2026, 10, 1)  # Currently in 2-month probation
            emp_emp = Employee(
                user_id=emp_user.id,
                employee_code="EMP003",
                name="Arun Kumar",
                department_id=eng_dept.id,
                designation="Software Engineer",
                manager_id=mgr_emp.id,
                joining_date=join_d,
                probation_end_date=add_two_months(join_d),
                phone="9876543212",
                emergency_contact="Kumar - 9876500003",
            )
            db.add(emp_emp)

        db.commit()
        print("Seeded 3 departments and 3 employees (EMP001 -> EMP002 -> EMP003).")
    finally:
        db.close()


if __name__ == "__main__":
    run()