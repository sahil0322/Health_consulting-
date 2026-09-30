"""
Central app configuration, loaded from environment variables (.env in dev).

Nothing here is a real secret — see .env.example for the variable names
this expects. Never commit a populated .env file.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    app_name: str = "Consult API"
    environment: str = "development"  # development | staging | production
    api_prefix: str = "/api"

    # --- Database ---
    database_url: str = "postgresql+psycopg://consult:consult@localhost:5432/consult"

    # --- Auth ---
    jwt_secret_key: str = "CHANGE_ME_IN_ENV"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8-hour shift-length session

    # --- CORS ---
    cors_allow_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- AI / speech-to-text providers (keys live in env, never in code) ---
    llm_provider: str = "anthropic"  # anthropic | openai
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    openai_api_key: str | None = None
    speech_to_text_provider: str = "openai_whisper"  # only one supported currently

    # --- PII/PHI redaction (PID Section 7.1) ---
    pii_redaction_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
