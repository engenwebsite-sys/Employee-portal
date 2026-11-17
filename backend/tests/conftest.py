"""Tests run against a separate database so your dev data is never touched.

One-time setup:   CREATE DATABASE nemilink_portal_test;
Run:              pytest
"""
import os

# Must be set before the app is imported.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/nemilink_portal_test",
)
os.environ["ENVIRONMENT"] = "development"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-unused-outside-this-suite"

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import User

PASSWORD = "Welcome@123"


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    command.upgrade(Config("alembic.ini"), "head")
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    return TestClient(app)


def make_user(email, role, must_change=False, active=True):
    with SessionLocal() as db:
        db.add(
            User(
                email=email,
                role=role,
                password_hash=hash_password(PASSWORD),
                must_change_password=must_change,
                is_active=active,
            )
        )
        db.commit()


@pytest.fixture
def users():
    make_user("hr@x.com", "hr", must_change=True)
    make_user("manager@x.com", "manager")
    make_user("employee@x.com", "employee")


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}
