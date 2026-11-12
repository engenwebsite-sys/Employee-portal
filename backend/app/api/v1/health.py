from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class DatabaseHealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["connected"]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check whether the API server is running",
)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok", service=settings.app_name, version=settings.app_version
    )


@router.get(
    "/health/db",
    response_model=DatabaseHealthResponse,
    summary="Check whether PostgreSQL is reachable",
)
def database_health_check(db: Session = Depends(get_db)) -> DatabaseHealthResponse:
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not reachable. Check DATABASE_URL in .env.",
        )
    return DatabaseHealthResponse(status="ok", database="connected")
