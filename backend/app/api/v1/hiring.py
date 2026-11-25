from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models import Role, User
from app.models.hiring import HiringApplication, HiringCandidate, HiringInterview, HiringNotification, HiringOpening
from app.schemas.hiring import (
    ApplicationCreate, ApplicationFields, ApplicationOut, CandidateFields, CandidateLink, CandidateOut,
    HiringOverview, InterviewOut, InterviewReview, InterviewSchedule, ManagerOption, OpeningFields, OpeningOut,
)
from app.services.hiring_mail import deliver_interview_mail, queue_interview_mail

router = APIRouter(prefix="/hiring", tags=["Hiring"], dependencies=[Depends(require_roles(Role.HR))])
Database = Annotated[Session, Depends(get_db)]
HRUser = Annotated[User, Depends(require_roles(Role.HR))]


def _get_or_404(db: Session, model, record_id: int, *, lock: bool = False):
    record = db.get(model, record_id, with_for_update=lock)
    if not record:
        raise HTTPException(status_code=404, detail="Hiring record not found.")
    return record


def _manager(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active or user.role not in (Role.MANAGER.value, Role.HR.value):
        raise HTTPException(status_code=422, detail="Choose an active manager or HR user.")
    return user


def _hr_owner(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active or user.role != Role.HR.value:
        raise HTTPException(status_code=422, detail="Choose an active HR owner.")
    return user


def _opening_out(opening: HiringOpening) -> OpeningOut:
    return OpeningOut(
        id=opening.id, title=opening.title, division=opening.division, vacancies=opening.vacancies,
        status=opening.status, target_joining_date=opening.target_joining_date, rounds=opening.rounds,
        manager_id=opening.manager_id, hr_owner_id=opening.hr_owner_id,
        manager_email=opening.manager.email, hr_owner_email=opening.hr_owner.email,
    )


def _candidate_values(contact: CandidateFields) -> dict:
    values = contact.model_dump(mode="json")
    values["email"] = values["email"].lower()
    return values


def _commit_candidate_change(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="A candidate or application with these details already exists."
        ) from exc


@router.get("", response_model=HiringOverview)
def get_hiring(db: Database, response: Response):
    response.headers["Cache-Control"] = "no-store"
    openings = db.scalars(select(HiringOpening).options(
        joinedload(HiringOpening.hr_owner), joinedload(HiringOpening.manager),
    ).order_by(HiringOpening.id.desc())).all()
    applications = db.scalars(select(HiringApplication).options(
        joinedload(HiringApplication.candidate),
        selectinload(HiringApplication.interviews).selectinload(HiringInterview.notifications),
    ).order_by(HiringApplication.id.desc())).all()
    managers = db.scalars(select(User).where(
        User.is_active.is_(True), User.role.in_([Role.MANAGER.value, Role.HR.value]),
    ).order_by(User.email)).all()
    talent_pool = db.scalars(select(HiringCandidate).where(
        ~select(HiringApplication.id).where(HiringApplication.candidate_id == HiringCandidate.id).exists()
    ).order_by(HiringCandidate.id.desc())).all()
    return HiringOverview(
        talent_pool=[CandidateOut.model_validate(candidate) for candidate in talent_pool],
        openings=[_opening_out(opening) for opening in openings],
        applications=[ApplicationOut.model_validate(application) for application in applications],
        managers=[ManagerOption(id=user.id, role=user.role, name=user.name or user.email, email=user.email) for user in managers],
    )


@router.post("/openings", status_code=201, response_model=OpeningOut)
def create_opening(payload: OpeningFields, db: Database, hr: HRUser):
    _manager(db, payload.manager_id)
    owner = _hr_owner(db, payload.hr_owner_id or hr.id)
    opening = HiringOpening(**payload.model_dump(exclude={"hr_owner_id"}), hr_owner_id=owner.id)
    db.add(opening)
    db.commit()
    return _opening_out(opening)


@router.put("/openings/{opening_id}", response_model=OpeningOut)
def update_opening(opening_id: int, payload: OpeningFields, db: Database):
    opening = _get_or_404(db, HiringOpening, opening_id, lock=True)
    _manager(db, payload.manager_id)
    used_rounds = set(db.scalars(
        select(HiringInterview.round_name).join(HiringApplication).where(HiringApplication.opening_id == opening.id)
    ))
    if used_rounds - set(payload.rounds):
        raise HTTPException(status_code=409, detail="Keep rounds with interview history. You can reorder them.")
    if payload.hr_owner_id is not None:
        opening.hr_owner_id = _hr_owner(db, payload.hr_owner_id).id
    for field, value in payload.model_dump(exclude={"hr_owner_id"}).items():
        setattr(opening, field, value)
    db.commit()
    return _opening_out(opening)


@router.post("/candidates", status_code=201, response_model=CandidateOut)
def create_candidate(payload: CandidateFields, db: Database):
    candidate = HiringCandidate(**_candidate_values(payload))
    db.add(candidate)
    _commit_candidate_change(db)
    return candidate


@router.put("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, payload: CandidateFields, db: Database):
    candidate = _get_or_404(db, HiringCandidate, candidate_id, lock=True)
    for field, value in _candidate_values(payload).items():
        setattr(candidate, field, value)
    _commit_candidate_change(db)
    return candidate


def _opening_for_application(db: Session, opening_id: int) -> HiringOpening:
    opening = _get_or_404(db, HiringOpening, opening_id, lock=True)
    if opening.status == "Closed":
        raise HTTPException(status_code=409, detail="Reopen this opening before adding candidates.")
    return opening


def _create_application(db: Session, opening: HiringOpening, candidate: HiringCandidate, **fields):
    if candidate.id is not None and db.scalar(select(HiringApplication.id).where(
        HiringApplication.opening_id == opening.id, HiringApplication.candidate_id == candidate.id,
    )):
        raise HTTPException(status_code=409, detail="This candidate already has an application for this opening.")

    application = HiringApplication(opening_id=opening.id, candidate=candidate, **fields)
    db.add(application)
    _commit_candidate_change(db)
    return application


@router.post("/candidates/{candidate_id}/applications", status_code=201, response_model=ApplicationOut)
def link_candidate(candidate_id: int, payload: CandidateLink, db: Database):
    opening = _opening_for_application(db, payload.opening_id)
    candidate = _get_or_404(db, HiringCandidate, candidate_id, lock=True)
    return _create_application(db, opening, candidate, stage="Applied")


@router.post("/applications", status_code=201, response_model=ApplicationOut)
def create_application(payload: ApplicationCreate, db: Database):
    opening = _opening_for_application(db, payload.opening_id)
    contact = _candidate_values(payload.candidate)
    candidate = db.scalar(select(HiringCandidate).where(HiringCandidate.email == contact["email"]))
    if candidate is None:
        candidate = HiringCandidate(**contact)
        db.add(candidate)
    return _create_application(db, opening, candidate, **payload.model_dump(exclude={"candidate", "opening_id"}))


@router.put("/applications/{application_id}", response_model=ApplicationOut)
def update_application(application_id: int, payload: ApplicationFields, db: Database):
    application = _get_or_404(db, HiringApplication, application_id, lock=True)
    candidate = _get_or_404(db, HiringCandidate, application.candidate_id, lock=True)
    for field, value in _candidate_values(payload.candidate).items():
        setattr(candidate, field, value)
    for field, value in payload.model_dump(exclude={"candidate"}).items():
        setattr(application, field, value)
    _commit_candidate_change(db)
    return application


def _notify(db, background, application, interview, event, previous=None):
    _hr_owner(db, application.opening.hr_owner_id)
    _manager(db, application.opening.manager_id)
    db.execute(update(HiringNotification).where(
        HiringNotification.interview_id == interview.id,
        HiringNotification.status.in_(["Pending", "Failed"]),
    ).values(status="Superseded", error=None))
    notification = queue_interview_mail(db, application, interview, event, previous)
    db.commit()
    background.add_task(deliver_interview_mail, notification.id)


@router.put("/applications/{application_id}/interviews", response_model=InterviewOut)
def schedule_interview(application_id: int, payload: InterviewSchedule, db: Database, background: BackgroundTasks):
    application = _get_or_404(db, HiringApplication, application_id, lock=True)
    opening = _get_or_404(db, HiringOpening, application.opening_id, lock=True)
    _manager(db, opening.manager_id)
    if opening.status == "Closed" or application.stage in ("Joined", "Rejected", "Withdrawn"):
        raise HTTPException(status_code=409, detail="Only active applications can be scheduled.")
    if payload.round_name not in opening.rounds:
        raise HTTPException(status_code=422, detail="Choose a round configured for this opening.")
    interview = db.scalar(select(HiringInterview).where(
        HiringInterview.application_id == application.id, HiringInterview.round_name == payload.round_name,
    ).with_for_update())
    values = {
        "starts_at": payload.starts_at, "ends_at": payload.ends_at,
        "meeting_url": str(payload.meeting_url) if payload.meeting_url else None,
    }
    previous: tuple[datetime, datetime] | None = None
    event = "Scheduled"
    if interview is None:
        interview = HiringInterview(
            application_id=application.id, round_name=payload.round_name, attendance="Scheduled",
            result="Pending", **values,
        )
        db.add(interview)
        db.flush()
    else:
        if interview.attendance == "Attended":
            raise HTTPException(status_code=409, detail="This round has already been attended.")
        if interview.attendance == "Scheduled" and all(getattr(interview, key) == value for key, value in values.items()):
            latest = next(iter(interview.notifications), None)
            recipients = {opening.hr_owner.email, opening.manager.email}
            if latest and latest.status != "Superseded" and set(latest.recipients) == recipients:
                return interview
            _notify(db, background, application, interview, "Scheduled")
            return interview
        previous = (interview.starts_at, interview.ends_at)
        event = "Rescheduled"
        for key, value in values.items():
            setattr(interview, key, value)
        interview.attendance = "Scheduled"
        interview.result = "Pending"

    if application.stage in ("Applied", "Screening"):
        application.stage = "Interviewing"
    _notify(db, background, application, interview, event, previous)
    return interview


@router.put("/interviews/{interview_id}/review", response_model=InterviewOut)
def review_interview(interview_id: int, payload: InterviewReview, db: Database, background: BackgroundTasks):
    interview = _get_or_404(db, HiringInterview, interview_id, lock=True)
    if (interview.attendance != payload.attendance and
            (interview.attendance == "Cancelled" or payload.attendance == "Scheduled")):
        raise HTTPException(status_code=409, detail="Use Reschedule to reopen this interview.")
    newly_cancelled = payload.attendance == "Cancelled" and interview.attendance != "Cancelled"
    if newly_cancelled and interview.attendance == "Attended":
        raise HTTPException(status_code=409, detail="An attended interview cannot be cancelled.")
    for field, value in payload.model_dump().items():
        setattr(interview, field, value)
    if newly_cancelled:
        application = _get_or_404(db, HiringApplication, interview.application_id)
        _notify(db, background, application, interview, "Cancelled")
    else:
        db.commit()
    return interview


@router.post("/notifications/{notification_id}/retry", status_code=202)
def retry_notification(notification_id: int, db: Database, background: BackgroundTasks):
    notification = _get_or_404(db, HiringNotification, notification_id)
    if notification.status not in ("Failed", "Pending"):
        raise HTTPException(status_code=409, detail="Only pending or failed email can be retried.")
    background.add_task(deliver_interview_mail, notification.id, retry=True)
    return {"status": "Queued"}
