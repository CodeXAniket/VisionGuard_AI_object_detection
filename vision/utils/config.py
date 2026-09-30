import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    api_key: str
    model_path: str
    max_frame_width: int


def load_settings() -> Settings:
    """Reads the vision service configuration from environment variables (.env)."""
    return Settings(
        host=os.getenv("VISION_HOST", "127.0.0.1"),
        port=int(os.getenv("VISION_PORT", "8000")),
        api_key=os.getenv("VISION_API_KEY", ""),
        model_path=os.getenv("YOLO_MODEL", "yolov8n.pt"),
        max_frame_width=int(os.getenv("MAX_FRAME_WIDTH", "640")),
    )
