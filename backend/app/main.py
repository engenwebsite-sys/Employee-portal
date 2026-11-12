from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    description="Backend API for the Nemilink employee and HR portal.",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
