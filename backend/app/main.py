from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

import app.models  # noqa: F401 registers all models
from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models.project import Project

BACKEND_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BACKEND_DIR / "uploads"
AVATARS_DIR = UPLOAD_DIR / "avatars"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
try:
    Path("uploads/avatars").mkdir(parents=True, exist_ok=True)
except Exception:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Auto-create any missing tables on startup
        Base.metadata.create_all(bind=engine)

        # Auto-add avatar_url column to employees if missing (Postgres safe)
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
        except Exception:
            pass

        # Seed default projects if table is empty
        with Session(engine) as db:
            if not db.query(Project).first():
                db.add_all([
                    Project(name="Maarga AI", code="MAI", client="Maarga", status="Active"),
                    Project(name="Maarga AI & Elder Care", code="MAI-EC", client="Maarga", status="Active"),
                    Project(name="MaargaAI/CRM-Tool", code="CRM", client="Maarga", status="Active"),
                    Project(name="Nemilink Portal", code="NL-PORTAL", client="Nemilink Technologies", status="Active"),
                    Project(name="Internal Tool", code="INT", client="Internal", status="Active"),
                ])
                db.commit()
    except Exception as e:
        print(f"Startup DB init warning: {e}")
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend API for the Nemilink employee and HR portal.",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/v1/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads_api")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class RootResponse(BaseModel):
    message: str
    docs: str
    health: str


@app.get("/", response_model=RootResponse, tags=["Root"], summary="API welcome")
def root() -> RootResponse:
    return RootResponse(
        message="Welcome to Nemilink Employee Portal API",
        docs="/docs",
        health="/api/v1/health",
    )


app.include_router(api_router)
