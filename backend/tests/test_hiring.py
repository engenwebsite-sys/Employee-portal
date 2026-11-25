from app.core.config import settings
from app.services import hiring_mail
from tests.conftest import auth, login, make_user


def test_hr_hiring_workflow_and_internal_email(client, monkeypatch):
    emails = {
        "hr": "hiring-hr@nemilink.com",
        "manager": "hiring-manager@nemilink.com",
        "employee": "hiring-employee@nemilink.com",
    }
    headers = {}
    for role, email in emails.items():
        make_user(email, role)
        logged_in = login(client, email)
        assert logged_in.status_code == 200
        headers[role] = auth(logged_in.json())

    api = "/api/v1/hiring"
    for role in ("manager", "employee"):
        assert client.get(api, headers=headers[role]).status_code == 403
        assert client.post(api + "/openings", headers=headers[role], json={}).status_code == 403
        assert client.post(api + "/notifications/1/retry", headers=headers[role]).status_code == 403

    hr = headers["hr"]
    initial = client.get(api, headers=hr)
    assert initial.status_code == 200
    manager_id = next(user["id"] for user in initial.json()["managers"] if user["email"] == emails["manager"])
    owner_id = next(user["id"] for user in initial.json()["managers"] if user["email"] == emails["hr"])
    opening_payload = {
        "title": "Frontend Engineer", "division": "Nemilink", "vacancies": 2, "manager_id": manager_id,
        "hr_owner_id": owner_id, "rounds": ["Portfolio Review", "Technical Interview"],
    }
    opening = client.post(api + "/openings", headers=hr, json=opening_payload)
    assert opening.status_code == 201, opening.text
    opening_id = opening.json()["id"]
    candidate_payload = {
        "opening_id": opening_id,
        "candidate": {"name": "Test Applicant", "email": "candidate@example.com", "resume_url": "https://onedrive.live.com/resume"},
    }
    candidate = client.post(api + "/applications", headers=hr, json=candidate_payload)
    assert candidate.status_code == 201, candidate.text
    assert client.post(api + "/applications", headers=hr, json=candidate_payload).status_code == 409
    application_id = candidate.json()["id"]
    url = api + f"/applications/{application_id}/interviews"

    messages = []
    reject_manager = True

    class FakeMailer:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def starttls(self, **kwargs):
            pass

        def send_message(self, message):
            if reject_manager and message["To"] == emails["manager"]:
                raise OSError("Test delivery failure")
            messages.append(message)

    monkeypatch.setattr(settings, "hiring_email_from", "shared-hr@nemilink.com")
    monkeypatch.setattr(settings, "hiring_smtp_host", "mail.example.com")
    monkeypatch.setattr(settings, "hiring_smtp_port", 587)
    monkeypatch.setattr(settings, "hiring_smtp_username", "")
    monkeypatch.setattr(hiring_mail.smtplib, "SMTP", FakeMailer)

    schedule = {
        "round_name": "Portfolio Review", "starts_at": "2026-12-01T10:30:00+05:30",
        "ends_at": "2026-12-01T11:00:00+05:30", "meeting_url": "https://teams.microsoft.com/interview",
    }
    assert client.put(url, headers=hr, json={**schedule, "round_name": "Unknown"}).status_code == 422
    recorded = client.put(url, headers=hr, json=schedule)
    assert recorded.status_code == 200, recorded.text
    interview_id = recorded.json()["id"]

    def notifications():
        return client.get(api, headers=hr).json()["applications"][0]["interviews"][0]["notifications"]

    failed = notifications()[0]
    assert failed["status"] == "Failed"
    reject_manager = False
    assert client.post(api + f"/notifications/{failed['id']}/retry", headers=hr).status_code == 202
    assert notifications()[0]["status"] == "Sent"
    assert {message["To"] for message in messages} == {emails["hr"], emails["manager"]}
    assert all(message["From"] == "shared-hr@nemilink.com" for message in messages)
    assert "10:30 AM" in messages[-1].get_content()
    assert client.put(url, headers=hr, json=schedule).status_code == 200
    assert len(notifications()) == 1

    rescheduled = {**schedule, "starts_at": "2026-12-01T12:30:00+05:30", "ends_at": "2026-12-01T13:00:00+05:30"}
    assert client.put(url, headers=hr, json=rescheduled).status_code == 200
    assert notifications()[0]["event"] == "Rescheduled"
    assert "Previous time" in messages[-1].get_content()
    assert client.put(api + f"/openings/{opening_id}", headers=hr, json={
        **opening_payload, "rounds": ["Technical Interview"],
    }).status_code == 409

    reviewed = client.put(api + f"/interviews/{interview_id}/review", headers=hr, json={
        "attendance": "Attended", "result": "Passed", "feedback": "Good communication.",
    })
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["result"] == "Passed"
    assert client.put(url, headers=hr, json=rescheduled).status_code == 409

    reject_manager = True
    second_round = {**schedule, "round_name": "Technical Interview"}
    assert client.put(url, headers=hr, json=second_round).status_code == 200
    latest = notifications()[0]
    assert latest["status"] == "Failed"
    assert client.put(api + f"/openings/{opening_id}", headers=hr, json={
        **opening_payload, "manager_id": owner_id,
    }).status_code == 200
    sent_before_retry = len(messages)
    assert client.post(api + f"/notifications/{latest['id']}/retry", headers=hr).status_code == 202
    assert notifications()[0]["status"] == "Superseded"
    assert len(messages) == sent_before_retry
    assert client.put(url, headers=hr, json=second_round).status_code == 200
    assert notifications()[0]["status"] == "Sent"
    assert messages[-1]["To"] == emails["hr"]


def test_talent_pool_saves_candidate_before_any_opening_and_links_same_profile(client):
    from uuid import uuid4

    make_user("talent-hr@nemilink.com", "hr")
    make_user("talent-manager@nemilink.com", "manager")
    hr = auth(login(client, "talent-hr@nemilink.com").json())
    manager = auth(login(client, "talent-manager@nemilink.com").json())
    api = "/api/v1/hiring"
    initial = client.get(api, headers=hr).json()
    assert initial["openings"] == []
    manager_id = next(user["id"] for user in initial["managers"] if user["email"] == "talent-manager@nemilink.com")

    contact = {
        "name": "Talent Pool Candidate", "email": f"pool-{uuid4().hex}@example.com",
        "phone": "555-0100", "resume_url": "https://onedrive.live.com/test-resume",
    }
    assert client.post(api + "/candidates", headers=manager, json=contact).status_code == 403
    created = client.post(api + "/candidates", headers=hr, json=contact)
    assert created.status_code == 201, created.text
    candidate = created.json()
    assert candidate in client.get(api, headers=hr).json()["talent_pool"]
    assert client.post(api + "/candidates", headers=hr, json=contact).status_code == 409

    candidate_url = api + f"/candidates/{candidate['id']}"
    updated = client.put(candidate_url, headers=hr, json={**contact, "phone": "555-0200"})
    assert updated.status_code == 200
    assert updated.json()["phone"] == "555-0200"
    opening = client.post(api + "/openings", headers=hr, json={
        "title": "Backend Engineer", "division": "Nemilink", "vacancies": 1,
        "manager_id": manager_id, "rounds": ["Technical"],
    })
    assert opening.status_code == 201, opening.text
    link_url = candidate_url + "/applications"
    link = {"opening_id": opening.json()["id"]}
    assert client.post(link_url, headers=manager, json=link).status_code == 403
    application = client.post(link_url, headers=hr, json=link)
    assert application.status_code == 201, application.text
    assert application.json()["stage"] == "Applied"
    assert application.json()["candidate"] == {**contact, "phone": "555-0200"}
    assert client.post(link_url, headers=hr, json=link).status_code == 409
    pool = client.get(api, headers=hr).json()["talent_pool"]
    assert all(record["id"] != candidate["id"] for record in pool)
