from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def portal_today() -> date:
    return datetime.now(IST).date()
