from typing import List, Union
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "VeriFA AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "verifa_default_secret_key_change_in_production"
    ENCRYPTION_KEY: str = "k3s-P_x5R7z0v9-WvY9Qd_4K1A1B_XYZabcdef01234="
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    DATABASE_URL: str = "sqlite+aiosqlite:///./verifa.db"

    # Hugging Face evaluation models
    HHEM_MODEL_NAME: str = "vectara/hallucination_evaluation_model"
    DEVICE: str = "auto"  # "auto", "cuda", or "cpu"

    # CORS & Network
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    REQUEST_TIMEOUT_SECONDS: int = 30
    MAX_RESPONSE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5MB

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v


settings = Settings()
