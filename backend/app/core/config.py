from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables or the .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Nemilink Employee Portal API"
    app_version: str = "0.2.0"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/nemilink_portal"
    )
    # Comma separated list of allowed frontend origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Authentication (Step 2)
    jwt_secret_key: str = "dev-only-change-me-please-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Microsoft Entra ID SSO
    microsoft_tenant_id: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_redirect_uri: str = "http://localhost:5173/auth/microsoft/callback"
    allowed_login_domains: str = "nemilink.com,maargaai.com,engencbss.com"
    super_admin_emails: str = "sivachandran@maargaai.com,raja@engencbss.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_domain_set(self) -> set[str]:
        return {d.strip().lower() for d in self.allowed_login_domains.split(",") if d.strip()}

    @property
    def super_admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.super_admin_emails.split(",") if e.strip()}

    @property
    def microsoft_sso_enabled(self) -> bool:
        return bool(
            self.microsoft_tenant_id.strip()
            and self.microsoft_client_id.strip()
            and self.microsoft_client_secret.strip()
        )


@lru_cache
def get_settings() -> Settings:
    loaded = Settings()
    # Refuse to start outside development with the placeholder secret.
    if (
        loaded.environment != "development"
        and loaded.jwt_secret_key.startswith("dev-only")
    ):
        raise RuntimeError("Set a real JWT_SECRET_KEY in .env before deploying.")
    return loaded


settings = get_settings()
