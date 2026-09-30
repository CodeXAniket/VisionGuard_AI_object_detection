import io
import json

import cv2
import numpy as np
import pytest

from detector import Detection
from event_handler import EventHandlerRegistry
from server import create_app, parse_detect_params

API_KEY = "test-key"


class FakeDetector:
    """Stands in for YoloDetector so the HTTP layer can be tested without a model."""

    model_path = "fake.pt"

    def __init__(self, detections=None, loaded=True):
        self.detections = detections or []
        self.is_loaded = loaded
        self.load_error = None if loaded else "Model file not found: models/x.pt"
        self.class_names = ["person", "car"]

    def detect(self, frame, min_confidence):
        return [d for d in self.detections if d.confidence >= min_confidence]


def jpeg_bytes(width=64, height=48):
    ok, buffer = cv2.imencode(".jpg", np.zeros((height, width, 3), dtype=np.uint8))
    assert ok
    return buffer.tobytes()


def make_client(detector):
    app = create_app(detector, EventHandlerRegistry(), API_KEY)
    return app.test_client()


def post_frame(client, **overrides):
    data = {
        "frame": (io.BytesIO(jpeg_bytes()), "frame.jpg"),
        "session_id": "user-1",
        "target_classes": json.dumps(["person"]),
        "confidence_threshold": "0.5",
        "cooldown_seconds": "30",
    }
    data.update(overrides)
    data = {k: v for k, v in data.items() if v is not None}
    return client.post("/detect", data=data, headers={"X-API-Key": API_KEY}, content_type="multipart/form-data")


DETECTIONS = [
    Detection(0, "person", 0.91, (1, 2, 30, 40)),
    Detection(2, "car", 0.8, (5, 5, 20, 20)),
    Detection(0, "person", 0.3, (0, 0, 5, 5)),
]


def test_health_needs_no_api_key():
    response = make_client(FakeDetector()).get("/health")
    assert response.status_code == 200
    assert response.json["modelLoaded"] is True


def test_detect_requires_api_key():
    response = make_client(FakeDetector()).post("/detect")
    assert response.status_code == 403


def test_detect_returns_detections_and_events():
    response = post_frame(make_client(FakeDetector(DETECTIONS)))

    assert response.status_code == 200
    body = response.json
    assert body["frameWidth"] == 64 and body["frameHeight"] == 48
    # Low-confidence person (0.3) is filtered out; the car is returned but isn't a target.
    assert [(d["class"], d["target"]) for d in body["detections"]] == [("person", True), ("car", False)]
    assert [e["class"] for e in body["events"]] == ["person"]


def test_cooldown_applies_across_requests():
    client = make_client(FakeDetector(DETECTIONS))
    assert len(post_frame(client).json["events"]) == 1
    assert post_frame(client).json["events"] == []


def test_missing_frame_is_rejected():
    response = post_frame(make_client(FakeDetector()), frame=None)
    assert response.status_code == 400
    assert "frame" in response.json["message"]


def test_undecodable_frame_is_rejected():
    response = post_frame(make_client(FakeDetector()), frame=(io.BytesIO(b"not an image"), "x.jpg"))
    assert response.status_code == 400


def test_model_unavailable_returns_503():
    response = post_frame(make_client(FakeDetector(loaded=False)))
    assert response.status_code == 503
    assert "not found" in response.json["message"]


@pytest.mark.parametrize(
    "form, message",
    [
        ({"target_classes": "[]", "confidence_threshold": "0.5"}, "session_id"),
        ({"session_id": "u", "target_classes": "person"}, "JSON array"),
        ({"session_id": "u", "confidence_threshold": "1.5"}, "between 0 and 1"),
        ({"session_id": "u", "cooldown_seconds": "abc"}, "must be numbers"),
    ],
)
def test_parse_detect_params_validation(form, message):
    with pytest.raises(ValueError, match=message):
        parse_detect_params(form)
