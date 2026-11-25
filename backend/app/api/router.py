from fastapi import APIRouter

from app.api.v1 import auth, dev, employees, health, hiring, leaves, me, projects, timesheets
from app.core.config import settings

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(employees.router)
api_router.include_router(leaves.router)
api_router.include_router(timesheets.router)
api_router.include_router(projects.router)
api_router.include_router(hiring.router)
if settings.environment == "development":
    api_router.include_router(dev.router)