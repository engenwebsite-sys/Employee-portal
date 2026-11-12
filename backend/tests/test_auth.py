import jwt
from tests.conftest import PASSWORD, auth, login, make_user

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import User


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


def test_first_login_must_change_password(client, users):
    tokens = login(client, "hr@x.com").json()
    assert tokens["user"]["must_change_password"] is True
    # blocked everywhere except /me and change-password
    blocked = client.get("/api/v1/dev/hr-only", headers=auth(tokens))
    assert blocked.status_code == 403 and blocked.json()["detail"] == "password_change_required"
    assert client.get("/api/v1/me", headers=auth(tokens)).status_code == 200

    done = client.post(
        "/api/v1/auth/change-password",
        headers=auth(tokens),
        json={"current_password": PASSWORD, "new_password": "BrandNew123"},
    )
    assert done.status_code == 200
    new_tokens = done.json()
    assert new_tokens["user"]["must_change_password"] is False
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
