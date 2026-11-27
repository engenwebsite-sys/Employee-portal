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
        "profile": {
            "city": "Chennai", "role_category": "Software Engineering",
            "preferred_position": "Frontend Developer", "experience_type": "Experienced",
            "company": "Example Studio", "designation": "UI Developer",
            "experience_years": 2, "experience_months": 6, "current_ctc_lpa": "6.50",
            "expected_ctc_lpa": "8.25", "linkedin_url": "https://www.linkedin.com/in/example",
            "github_url": "https://github.com/example", "portfolio_url": "https://example.com/portfolio",
            "project_links": [{"name": "Design system", "url": "https://example.com/project"}],
        },
    }
    assert client.post(api + "/candidates", headers=manager, json=contact).status_code == 403
    created = client.post(api + "/candidates", headers=hr, json=contact)
    assert created.status_code == 201, created.text
    candidate = created.json()
    assert candidate in client.get(api, headers=hr).json()["talent_pool"]
    assert candidate["profile"]["current_ctc_lpa"] == "6.50"
    assert candidate["profile"]["company"] == "Example Studio"
    assert client.post(api + "/candidates", headers=hr, json=contact).status_code == 409

    candidate_url = api + f"/candidates/{candidate['id']}"
    legacy_update = {key: value for key, value in contact.items() if key != "profile"}
    updated = client.put(candidate_url, headers=hr, json={**legacy_update, "phone": "555-0200"})
    assert updated.status_code == 200
    assert updated.json()["phone"] == "555-0200"
    assert updated.json()["profile"] == candidate["profile"]

    fresher = {**contact["profile"], "experience_type": "Fresher"}
    fresher_result = client.put(candidate_url, headers=hr, json={
        **contact, "phone": "555-0200", "profile": fresher,
    })
    assert fresher_result.status_code == 200
    profile = fresher_result.json()["profile"]
    assert profile["company"] is None
    assert profile["experience_years"] is None
    assert profile["current_ctc_lpa"] is None
    assert profile["expected_ctc_lpa"] == "8.25"
    assert profile["project_links"] == contact["profile"]["project_links"]
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
    assert application.json()["candidate"] == {**contact, "phone": "555-0200", "profile": profile}
    assert client.post(link_url, headers=hr, json=link).status_code == 409
    pool = client.get(api, headers=hr).json()["talent_pool"]
    assert all(record["id"] != candidate["id"] for record in pool)
    assert client.delete(candidate_url, headers=hr).status_code == 409
    assert client.get(api, headers=hr).json()["applications"][0]["id"] == application.json()["id"]


def test_hr_can_delete_unlinked_talent_pool_candidate(client):
    from uuid import uuid4

    make_user("delete-hr@nemilink.com", "hr")
    make_user("delete-manager@nemilink.com", "manager")
    hr = auth(login(client, "delete-hr@nemilink.com").json())
    manager = auth(login(client, "delete-manager@nemilink.com").json())
    api = "/api/v1/hiring"
    contact = {"name": "Candidate to Remove", "email": f"remove-{uuid4().hex}@example.com"}
    created = client.post(api + "/candidates", headers=hr, json=contact)
    assert created.status_code == 201, created.text
    candidate_id = created.json()["id"]
    candidate_url = api + f"/candidates/{candidate_id}"

    assert client.delete(candidate_url, headers=manager).status_code == 403
    assert client.delete(candidate_url, headers=hr).status_code == 204
    pool = client.get(api, headers=hr).json()["talent_pool"]
    assert all(record["id"] != candidate_id for record in pool)
    assert client.delete(candidate_url, headers=hr).status_code == 404
    assert client.post(api + "/candidates", headers=hr, json=contact).status_code == 201


def test_manual_hiring_tracker_and_opening_deadline(client, monkeypatch):
    from datetime import date

    from app.api.v1 import hiring

    today = date(2026, 11, 26)
    monkeypatch.setattr(hiring, "portal_today", lambda: today)
    make_user("tracker-hr@nemilink.com", "hr")
    make_user("tracker-manager@nemilink.com", "manager")
    hr = auth(login(client, "tracker-hr@nemilink.com").json())
    manager = auth(login(client, "tracker-manager@nemilink.com").json())
    api = "/api/v1/hiring"
    opening_payload = {
        "title": "Example Designer", "division": "Example Company", "domain": "Design",
        "experience_required": "3+ years", "closing_date": today.isoformat(),
    }

    assert client.get(api, headers=hr).json()["openings"] == []
    assert client.post(api + "/openings", headers=manager, json=opening_payload).status_code == 403
    assert client.post(api + "/openings", headers=hr, json={
        **opening_payload, "closing_date": "2026-11-25",
    }).status_code == 422
    created = client.post(api + "/openings", headers=hr, json=opening_payload)
    assert created.status_code == 201, created.text
    opening = created.json()
    assert opening["status"] == "Open"
    assert all(opening[key] == value for key, value in opening_payload.items())
    assert opening["rounds"] == []
    opening_id = opening["id"]

    unused = client.post(api + "/openings", headers=hr, json={**opening_payload, "title": "Unused Opening"})
    assert unused.status_code == 201, unused.text
    unused_url = api + f"/openings/{unused.json()['id']}"
    assert client.delete(unused_url, headers=manager).status_code == 403
    assert client.delete(unused_url, headers=hr).status_code == 204
    assert client.delete(unused_url, headers=hr).status_code == 404
    assert [record["id"] for record in client.get(api, headers=hr).json()["openings"]] == [opening_id]

    tracking = {
        "source": "Referral", "referred_by": "Employee Referral", "experience": "4 years",
        "applied_on": today.isoformat(), "notes": "Portfolio received.",
    }
    pool_payload = {"name": "Manual Candidate", "intake": {"role": "Designer", **tracking}}
    assert client.post(api + "/candidates", headers=manager, json=pool_payload).status_code == 403
    pool_created = client.post(api + "/candidates", headers=hr, json=pool_payload)
    assert pool_created.status_code == 201, pool_created.text
    candidate = pool_created.json()
    assert candidate["email"] is None
    assert candidate["intake"] == pool_payload["intake"]

    link_url = api + f"/candidates/{candidate['id']}/applications"
    linked = client.post(link_url, headers=hr, json={"opening_id": opening_id})
    assert linked.status_code == 201, linked.text
    application = linked.json()
    assert all(application[key] == value for key, value in tracking.items())
    assert application["candidate"]["name"] == "Manual Candidate"
    assert client.delete(api + f"/openings/{opening_id}", headers=hr).status_code == 409

    application_url = api + f"/applications/{application['id']}"
    decision = {"candidate": {"name": "Manual Candidate"}, "stage": "Tests", "decision": "In Process"}
    assert client.put(application_url, headers=hr, json={
        **decision, "decision_on": "2026-11-25",
    }).status_code == 422
    updated = client.put(application_url, headers=hr, json={**decision, "decision_on": today.isoformat()})
    assert updated.status_code == 200, updated.text
    assert updated.json()["stage"] == "Tests"
    assert updated.json()["decision"] == "In Process"
    assert updated.json()["decision_on"] == today.isoformat()
    assert updated.json()["referred_by"] == tracking["referred_by"]

    new_application = {
        "opening_id": opening_id, "candidate": {"name": "Manual Candidate"}, "source": "LinkedIn",
    }
    assert client.post(api + "/applications", headers=hr, json=new_application).status_code == 201
    monkeypatch.setattr(hiring, "portal_today", lambda: date(2026, 11, 27))
    overview = client.get(api, headers=hr).json()
    assert overview["openings"][0]["status"] == "Closed"
    assert len(overview["applications"]) == 2
    assert client.post(api + "/applications", headers=hr, json=new_application).status_code == 409
    assert client.post(link_url, headers=hr, json={"opening_id": opening_id}).status_code == 409

    opening_url = api + f"/openings/{opening_id}"
    edited = client.put(opening_url, headers=hr, json={**opening_payload, "closing_date": "2026-11-30"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "Open"
    assert client.post(opening_url + "/close", headers=manager).status_code == 403
    for _ in range(2):
        closed = client.post(opening_url + "/close", headers=hr)
        assert closed.status_code == 200
        assert closed.json()["status"] == "Closed"
    assert client.post(api + "/applications", headers=hr, json=new_application).status_code == 409
    assert client.put(application_url, headers=hr, json={**decision, "stage": "Offer"}).status_code == 200


def test_hr_can_add_reusable_hiring_domains(client):
    make_user("domains-hr@nemilink.com", "hr")
    make_user("domains-manager@nemilink.com", "manager")
    hr = auth(login(client, "domains-hr@nemilink.com").json())
    manager = auth(login(client, "domains-manager@nemilink.com").json())
    api = "/api/v1/hiring"

    overview = client.get(api, headers=hr).json()
    assert {"SAP", "UI/UX Design", "DevOps / SRE"} <= set(overview["domains"])
    assert overview["openings"] == []
    assert client.post(api + "/domains", headers=manager, json={"name": "Embedded Systems"}).status_code == 403
    assert client.post(api + "/domains", headers=hr, json={"name": "  "}).status_code == 422

    added = client.post(api + "/domains", headers=hr, json={"name": "  Embedded Systems  "})
    assert added.status_code == 200, added.text
    assert added.json() == {"name": "Embedded Systems"}
    repeated = client.post(api + "/domains", headers=hr, json={"name": "embedded systems"})
    assert repeated.json() == added.json()

    overview = client.get(api, headers=hr).json()
    assert overview["domains"].count("Embedded Systems") == 1
    assert "embedded systems" not in overview["domains"]
    assert overview["openings"] == []
