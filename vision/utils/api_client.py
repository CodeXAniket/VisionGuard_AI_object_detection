"""Posts detection events from the local monitor to the Node.js API
(POST /api/detections). The API - not Python - stores the image in S3 and
the metadata in MongoDB."""
import json

import requests

from utils.logger import get_logger

logger = get_logger("api_client")


def post_detection_event(api_url: str, token: str, image_jpeg: bytes, detection, frame_width: int, frame_height: int) -> bool:
    """Returns True if the backend accepted the event. Never raises: a failed
    upload is logged and monitoring continues."""
    try:
        response = requests.post(
            f"{api_url.rstrip('/')}/detections",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("snapshot.jpg", image_jpeg, "image/jpeg")},
            data={
                "objectClass": detection.class_name,
                "confidence": str(round(detection.confidence, 4)),
                "bbox": json.dumps(list(detection.bbox)),
                "frameWidth": str(frame_width),
                "frameHeight": str(frame_height),
            },
            timeout=10,
        )
    except requests.RequestException as error:
        logger.error("Could not reach the VisionGuard API: %s", error)
        return False

    if response.status_code != 201:
        message = response.json().get("message", response.text) if response.content else response.reason
        logger.error("API rejected the event (%d): %s", response.status_code, message)
        return False

    logger.info("Event stored by API: id=%s", response.json()["data"]["id"])
    return True
