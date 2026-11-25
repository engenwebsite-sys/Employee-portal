import logging
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.portal_date import IST
from app.db.session import SessionLocal
from app.models.hiring import HiringApplication, HiringInterview, HiringNotification, HiringOpening
from app.models.user import Role

logger = logging.getLogger(__name__)


def _interview_time(start: datetime, end: datetime) -> str:
    start, end = start.astimezone(IST), end.astimezone(IST)
    end_format = "%I:%M %p" if start.date() == end.date() else "%a, %d %b %Y at %I:%M %p"
    return f"{start:%a, %d %b %Y at %I:%M %p} – {end.strftime(end_format)} IST"


def queue_interview_mail(
    db: Session,
    application: HiringApplication,
    interview: HiringInterview,
    event: str,
    previous: tuple[datetime, datetime] | None = None,
) -> HiringNotification:
    opening = application.opening
    candidate = application.candidate
    manager = opening.manager.name or opening.manager.email
    owner = opening.hr_owner.name or opening.hr_owner.email
    subject = f"Interview {event.lower()} | {opening.title} | {candidate.name} | {interview.round_name}"
    lines = [
        f"Hi {manager} and {owner},", "",
        f"The {interview.round_name} interview with {candidate.name} for the "
        f"{opening.title} position has been {event.lower()}.", "",
    ]
    if previous:
        lines.append(f"Previous time  {_interview_time(*previous)}")
    lines.append(f"Interview time  {_interview_time(interview.starts_at, interview.ends_at)}")
    if event != "Cancelled":
        if interview.meeting_url:
            lines.append(f"Join interview  {interview.meeting_url}")
        if candidate.resume_url:
            lines.append(f"Candidate résumé  {candidate.resume_url}")
        lines += ["", f"Please review the résumé before the interview and share your assessment with {owner} afterward."]
    lines += ["", "Regards,", "Talent Acquisition", "", "Internal hiring correspondence"]
    notification = HiringNotification(
        interview_id=interview.id, event=event, status="Pending",
        recipients=list(dict.fromkeys([opening.hr_owner.email, opening.manager.email])),
        reply_to=opening.hr_owner.email,
        subject=" ".join(subject.splitlines()), body="\n".join(lines),
    )
    db.add(notification)
    return notification


def deliver_interview_mail(notification_id: int, retry: bool = False) -> None:
    with SessionLocal() as db:
        notification = db.scalar(
            select(HiringNotification).where(HiringNotification.id == notification_id).with_for_update()
        )
        if not notification or notification.status not in ({"Pending", "Failed"} if retry else {"Pending"}):
            return
        opening = db.scalar(
            select(HiringOpening).join(HiringApplication).join(HiringInterview)
            .where(HiringInterview.id == notification.interview_id)
        )
        if (not opening or not opening.hr_owner.is_active or opening.hr_owner.role != Role.HR.value
                or not opening.manager.is_active or opening.manager.role not in (Role.HR.value, Role.MANAGER.value)
                or set(notification.recipients) != {opening.hr_owner.email, opening.manager.email}):
            notification.status = "Superseded"
            notification.error = "Hiring contacts changed. Save the interview schedule again to notify the current contacts."
            db.commit()
            return
        if not settings.hiring_smtp_host or not settings.hiring_email_from:
            notification.status = "Failed"
            notification.error = "The HR mailbox and SMTP relay are not configured."
            db.commit()
            return

        # Send each recipient separately so a retry can skip recipients already accepted by the relay.
        remaining = list(notification.remaining_recipients or notification.recipients)
        try:
            tls = ssl.create_default_context()
            if settings.hiring_smtp_port == 465:
                client = smtplib.SMTP_SSL(settings.hiring_smtp_host, settings.hiring_smtp_port, timeout=10, context=tls)
            else:
                client = smtplib.SMTP(settings.hiring_smtp_host, settings.hiring_smtp_port, timeout=10)
            with client:
                if settings.hiring_smtp_port != 465:
                    client.starttls(context=tls)
                if settings.hiring_smtp_username:
                    client.login(settings.hiring_smtp_username, settings.hiring_smtp_password)
                for recipient in list(remaining):
                    message = EmailMessage()
                    message["From"] = settings.hiring_email_from
                    message["To"] = recipient
                    message["Reply-To"] = notification.reply_to
                    message["Subject"] = notification.subject
                    message.set_content(notification.body)
                    client.send_message(message)
                    remaining.remove(recipient)
        except (OSError, smtplib.SMTPException, ValueError):
            logger.warning("Hiring email delivery failed for notification %s", notification_id)
        notification.remaining_recipients = remaining
        notification.status = "Failed" if remaining else "Sent"
        notification.error = "Email delivery failed for one or more recipients. Check the HR mail settings and retry." if remaining else None
        db.commit()
