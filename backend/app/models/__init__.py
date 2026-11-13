# Import every model here so Alembic can see it.
from app.db.base import Base  # noqa: F401
from app.models.user import RefreshToken, Role, User  # noqa: F401
from app.models.employee import Department, Employee  # noqa: F401
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType  # noqa: F401
from app.models.timesheet import TimesheetEntry  # noqa: F401
from app.models.project import Project  # noqa: F401