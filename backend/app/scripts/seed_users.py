"""Create login accounts from the command line (there is no public sign-up).

  python -m app.scripts.seed_users --email you@company.com --role hr
      Creates one account and asks for a temporary password.

  python -m app.scripts.seed_users --demo
      Creates hr@ / manager@ / employee@nemilink.com for testing (development only).
      Add --reset to put existing demo accounts back to the demo password.
"""
import argparse
import getpass
import sys

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Role, User
from app.services.auth_service import get_user_by_email

DEMO_PASSWORD = "Welcome@123"
# (email, role, must_change_password) - HR starts with the forced change so you can test it.
DEMO_USERS = [
    ("hr@nemilink.com", Role.HR, True),
    ("manager@nemilink.com", Role.MANAGER, False),
    ("employee@nemilink.com", Role.EMPLOYEE, False),
]


def upsert(db: Session, email: str, role: Role, password: str, must_change: bool, reset: bool) -> None:
    email = email.strip().lower()
    user = get_user_by_email(db, email)
    if user is None:
        db.add(
            User(
                email=email,
                role=role.value,
                password_hash=hash_password(password),
                must_change_password=must_change,
            )
        )
        print(f"created  {email} ({role.value})")
    elif reset:
        user.password_hash = hash_password(password)
        user.role = role.value
        user.is_active = True
        user.must_change_password = must_change
        print(f"reset    {email} ({role.value})")
    else:
        print(f"exists   {email} (use --reset to change it)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create Nemilink login accounts.")
    parser.add_argument("--demo", action="store_true", help="create the 3 demo accounts")
    parser.add_argument("--reset", action="store_true", help="reset existing accounts")
    parser.add_argument("--email")
    parser.add_argument("--role", choices=[r.value for r in Role], default=Role.HR.value)
    args = parser.parse_args()

    if not args.demo and not args.email:
        parser.error("use --demo, or --email with --role")

    with SessionLocal() as db:
        if args.demo:
            if settings.environment != "development":
                print("Demo accounts are only allowed when ENVIRONMENT=development.")
                return 1
            for email, role, must_change in DEMO_USERS:
                upsert(db, email, role, DEMO_PASSWORD, must_change, args.reset)
            print(f"\nDemo password for all three: {DEMO_PASSWORD}")
        else:
            password = getpass.getpass("Temporary password (min 8 chars): ")
            if len(password) < 8:
                print("Password is too short.")
                return 1
            upsert(db, args.email, Role(args.role), password, True, args.reset)
        db.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
