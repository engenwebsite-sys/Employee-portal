from datetime import date
from app.services.leave_service import compute_accrued_months, count_working_days


def test_leave_accrual_calculation():
    # Joined in July 2026, checking in November 2026
    nov_2026 = date(2026, 11, 16)
    july_join = date(2026, 7, 10)
    accrued = compute_accrued_months(nov_2026, july_join)
    assert accrued == 5, f"Expected 5 accrued months for July->Nov, got {accrued}"

    # Joined in January 2026, checking in November 2026
    jan_join = date(2026, 1, 5)
    accrued_jan = compute_accrued_months(nov_2026, jan_join)
    assert accrued_jan == 11, f"Expected 11 accrued months for Jan->Nov, got {accrued_jan}"

    # Joined in November 2026 (current month)
    nov_join = date(2026, 11, 2)
    accrued_nov = compute_accrued_months(nov_2026, nov_join)
    assert accrued_nov == 1, f"Expected 1 accrued month for Nov->Nov, got {accrued_nov}"

    # Joined in previous year (e.g. 2025)
    prev_year_join = date(2025, 4, 15)
    accrued_prev = compute_accrued_months(nov_2026, prev_year_join)
    assert accrued_prev == 11, f"Expected 11 accrued months for Jan->Nov, got {accrued_prev}"

    print("All leave accrual tests passed successfully!")


def test_working_days_calculation():
    # Nov 18, 2026 (Wed) to Nov 24, 2026 (Tue)
    # Wed, Thu, Fri, Sat (off), Sun (off), Mon, Tue -> 5 working days
    days = count_working_days(date(2026, 11, 18), date(2026, 11, 24))
    assert days == 5, f"Expected 5 working days, got {days}"

    # Weekend only: Nov 21, 2026 (Sat) to Nov 22, 2026 (Sun)
    assert count_working_days(date(2026, 11, 21), date(2026, 11, 22)) == 0

    # Single Friday: Nov 20, 2026
    assert count_working_days(date(2026, 11, 20), date(2026, 11, 20)) == 1

    # Single Saturday: Nov 21, 2026
    assert count_working_days(date(2026, 11, 21), date(2026, 11, 21)) == 0

    print("All working days tests passed successfully!")


if __name__ == "__main__":
    test_leave_accrual_calculation()
    test_working_days_calculation()


