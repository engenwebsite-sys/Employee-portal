import jwt
from sqlalchemy import select
from tests.conftest import PASSWORD, auth, login, make_user

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Employee, User


def test_login_success_and_email_is_case_insensitive(client, users):
    res = login(client, "  Employee@X.com ")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "employee"
    assert body["expires_in"] == settings.access_token_expire_minutes * 60


def test_wrong_password_and_unknown_email_give_same_error(client, users):
    a = login(client, "employee@x.com", "nope-nope-1")
    b = login(client, "ghost@x.com")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_me_requires_token(client, users):
    assert client.get("/api/v1/me").status_code == 401
    tokens = login(client, "employee@x.com").json()
    me = client.get("/api/v1/me", headers=auth(tokens))
    assert me.status_code == 200 and me.json()["email"] == "employee@x.com"


def test_garbage_and_refresh_tokens_are_not_accepted_as_access(client, users):
    tokens = login(client, "employee@x.com").json()
    for bad in ["abc", tokens["refresh_token"]]:
        r = client.get("/api/v1/me", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 401


def test_expired_access_token_rejected(client, users, monkeypatch):
    monkeypatch.setattr(settings, "access_token_expire_minutes", -1)
    tokens = login(client, "employee@x.com").json()
    assert client.get("/api/v1/me", headers=auth(tokens)).status_code == 401


def test_token_signed_with_other_key_rejected(client, users):
    forged = jwt.encode({"sub": "1", "type": "access", "exp": 9999999999}, "other-key", "HS256")
    r = client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_refresh_rotates_and_old_token_dies(client, users):
    first = login(client, "employee@x.com").json()
    second = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    assert second.json()["refresh_token"] != first["refresh_token"]
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reuse.status_code == 401


def test_logout_revokes_refresh_token(client, users):
    tokens = login(client, "employee@x.com").json()
    out = client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 204
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert again.status_code == 401


def test_browser_session_refresh_and_logout_use_http_only_cookie(client, users):
    headers = {"X-Portal-Session": "browser"}
    first = client.post("/api/v1/auth/login", headers=headers, json={
        "email": "employee@x.com", "password": PASSWORD,
    })
    assert first.status_code == 200
    assert "refresh_token" not in first.json()
    assert "HttpOnly" in first.headers["set-cookie"]
    original = client.cookies.get("nemilink_refresh")
    assert client.post("/api/v1/auth/refresh").status_code == 401
    rotated = client.post("/api/v1/auth/refresh", headers=headers)
    assert rotated.status_code == 200
    assert "refresh_token" not in rotated.json()
    assert client.cookies.get("nemilink_refresh") != original
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.post("/api/v1/auth/refresh", headers=headers).status_code == 401


def test_microsoft_callback_requires_matching_state(client):
    result = client.post("/api/v1/auth/microsoft/callback", json={"code": "test", "state": "unexpected"})
    assert result.status_code == 400


def test_microsoft_sign_in_verifies_existing_employee_without_creating_another(client, monkeypatch):
    make_user("hr@nemilink.com", "hr")
    hr = auth(login(client, "hr@nemilink.com").json())
    email = "verified@nemilink.com"
    created = client.post("/api/v1/employees", headers=hr, json={
        "email": email, "employee_code": "NLT-024", "name": "Test Employee",
        "joining_date": "2026-01-01",
    })
    assert created.status_code == 201
    employee = created.json()
    assert employee["microsoft_verified"] is False
    reset = client.post(f"/api/v1/employees/{employee['id']}/reset-password", headers=hr)
    assert reset.status_code == 409

    def complete_sign_in(microsoft_email):
        monkeypatch.setattr(
            "app.api.v1.auth.exchange_code_for_profile",
            lambda code, verifier: (microsoft_email, "Microsoft Name"),
        )
        client.cookies.set("nemilink_microsoft_flow", "test-state.test-verifier", path="/api/v1/auth")
        return client.post("/api/v1/auth/microsoft/callback", json={"code": "test", "state": "test-state"})

    denied = complete_sign_in("alias@nemilink.com")
    assert denied.status_code == 403
    assert "alias@nemilink.com" in denied.json()["detail"]
    allowed = complete_sign_in(email)
    assert allowed.status_code == 200
    signed_in = allowed.json()["user"]["employee"]
    assert signed_in["id"] == employee["id"]
    assert signed_in["employee_code"] == "NLT-024"
    assert signed_in["microsoft_verified"] is True
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email == "alias@nemilink.com")) is None
        assert db.scalars(select(Employee)).all()[0].id == employee["id"]


def test_first_login_must_change_password(client, users):
    tokens = login(client, "hr@x.com").json()
    assert tokens["user"]["must_change_password"] is True
    # blocked everywhere except /me and change-password
    blocked = client.get("/api/v1/dev/hr-only", headers=auth(tokens))
    assert blocked.status_code == 403 and blocked.json()["detail"] == "password_change_required"
    for path in ("projects", "timesheets/my", "leaves/balances"):
        response = client.get(f"/api/v1/{path}", headers=auth(tokens))
        assert response.status_code == 403
        assert response.json()["detail"] == "password_change_required"
    assert client.get("/api/v1/me", headers=auth(tokens)).status_code == 200

    done = client.post(
        "/api/v1/auth/change-password",
        headers=auth(tokens),
        json={"current_password": PASSWORD, "new_password": "BrandNew123"},
    )
    assert done.status_code == 200
    new_tokens = done.json()
    assert new_tokens["user"]["must_change_password"] is False
    assert client.get("/api/v1/me", headers=auth(tokens)).status_code == 401
    assert client.get("/api/v1/dev/hr-only", headers=auth(new_tokens)).status_code == 200
    # every older session was signed out, new password works, old one does not
    old_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert old_refresh.status_code == 401
    assert login(client, "hr@x.com", "BrandNew123").status_code == 200
    assert login(client, "hr@x.com", PASSWORD).status_code == 401


def test_change_password_rules(client, users):
    tokens = login(client, "employee@x.com").json()
    url = "/api/v1/auth/change-password"
    wrong = client.post(url, headers=auth(tokens), json={"current_password": "bad", "new_password": "Abcdefg1"})
    assert wrong.status_code == 400
    same = client.post(url, headers=auth(tokens), json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert same.status_code == 400
    for weak in ["short1", "onlyletters", "12345678"]:
        r = client.post(url, headers=auth(tokens), json={"current_password": PASSWORD, "new_password": weak})
        assert r.status_code == 422


def test_role_guards(client, users):
    emp = login(client, "employee@x.com").json()
    mgr = login(client, "manager@x.com").json()
    assert client.get("/api/v1/dev/any-role", headers=auth(emp)).status_code == 200
    assert client.get("/api/v1/dev/manager-or-hr", headers=auth(emp)).status_code == 403
    assert client.get("/api/v1/dev/manager-or-hr", headers=auth(mgr)).status_code == 200
    assert client.get("/api/v1/dev/hr-only", headers=auth(mgr)).status_code == 403
    assert client.get("/api/v1/dev/hr-only").status_code == 401


def test_role_is_read_from_database_not_token(client, users):
    tokens = login(client, "employee@x.com").json()  # token says "employee"
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="employee@x.com").one()
        u.role = "hr"
        db.commit()
    assert client.get("/api/v1/dev/hr-only", headers=auth(tokens)).status_code == 200
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="employee@x.com").one()
        u.role = "employee"
        db.commit()
    assert client.get("/api/v1/dev/hr-only", headers=auth(tokens)).status_code == 403


def test_disabled_user_is_locked_out_immediately(client, users):
    tokens = login(client, "employee@x.com").json()
    with SessionLocal() as db:
        db.query(User).filter_by(email="employee@x.com").one().is_active = False
        db.commit()
    assert client.get("/api/v1/me", headers=auth(tokens)).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert login(client, "employee@x.com").status_code == 403
