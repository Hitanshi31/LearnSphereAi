from pathlib import Path
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Settings:
    max_upload_bytes: int
    upload_dir: Path
    allowed_origins: list[str]
    chroma_dir: Path
    gemini_api_key: str | None
    gemini_model: str

    def __init__(self) -> None:
        self.max_upload_bytes = int(os.getenv("LEARN_SPHERE_MAX_UPLOAD_MB", "20")) * 1024 * 1024
        self.upload_dir = Path(os.getenv("LEARN_SPHERE_UPLOAD_DIR", "./data/uploads"))
        self.allowed_origins = os.getenv(
            "LEARN_SPHERE_ALLOWED_ORIGINS", "http://localhost:3000"
        ).split(",")
        self.chroma_dir = Path(os.getenv("LEARN_SPHERE_CHROMA_DIR", "./data/chroma"))
        self.gemini_api_key = os.getenv("LEARN_SPHERE_GEMINI_API_KEY") or None
        self.gemini_model = os.getenv("LEARN_SPHERE_GEMINI_MODEL", "gemini-2.5-flash")


@lru_cache
def get_settings() -> Settings:
    return Settings()
