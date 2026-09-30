"""VisionGuard vision service: a small HTTP API around the YOLO detector.

Only the Node.js backend calls this service (never the browser). It has no
database access - it receives a frame, returns detections and says which of
them should become events. The backend owns storage (S3 + MongoDB).

    GET  /health   model status (no API key required)
    GET  /classes  class names the model can detect
    POST /detect   multipart: frame (JPEG/PNG), session_id, target_classes (JSON list),
                   confidence_threshold, cooldown_seconds

Run:  python server.py
"""
import json
import time
from dataclasses import dataclass

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from detector import ModelLoadError, YoloDetector, filter_detections
from event_handler import EventHandlerRegistry
from utils.config import load_settings
from utils.image import decode_image
from utils.logger import get_logger

logger = get_logger("server")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@dataclass(frozen=True)
class DetectParams:
    session_id: str
    target_classes: set[str]
    confidence_threshold: float
    cooldown_seconds: float


def parse_detect_params(form) -> DetectParams:
    """Validates the form fields of POST /detect. Raises ValueError with a readable message."""
    session_id = (form.get("session_id") or "").strip()
    if not session_id:
        raise ValueError("session_id is required")

    try:
        target_classes = json.loads(form.get("target_classes", "[]"))
    except json.JSONDecodeError:
        raise ValueError("target_classes must be a JSON array of class names") from None
    if not isinstance(target_classes, list) or not all(isinstance(c, str) for c in target_classes):
        raise ValueError("target_classes must be a JSON array of class names")

    try:
        confidence = float(form.get("confidence_threshold", "0.5"))
        cooldown = float(form.get("cooldown_seconds", "30"))
    except ValueError:
        raise ValueError("confidence_threshold and cooldown_seconds must be numbers") from None
    if not 0 < confidence < 1:
        raise ValueError("confidence_threshold must be between 0 and 1")
    if cooldown < 0:
        raise ValueError("cooldown_seconds must not be negative")

    return DetectParams(session_id, set(target_classes), confidence, cooldown)


def error_response(status: int, message: str):
    return jsonify({"success": False, "message": message}), status


def create_app(detector: YoloDetector, event_handlers: EventHandlerRegistry, api_key: str) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

    @app.before_request
    def require_api_key():
        # Shared secret between Node and Python so random local processes
        # can't use the (expensive) inference endpoint.
        if request.endpoint == "health" or not api_key:
            return None
        if request.headers.get("X-API-Key") != api_key:
            return error_response(403, "Invalid or missing API key")
        return None

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "modelLoaded": detector.is_loaded,
                "model": detector.model_path,
                "message": "ready" if detector.is_loaded else detector.load_error,
            }
        )

    @app.get("/classes")
    def classes():
        if not detector.is_loaded:
            return error_response(503, f"YOLO model is not available: {detector.load_error}")
        return jsonify({"classes": detector.class_names})

    @app.post("/detect")
    def detect():
        if not detector.is_loaded:
            return error_response(503, f"YOLO model is not available: {detector.load_error}")

        frame_file = request.files.get("frame")
        if frame_file is None:
            return error_response(400, 'A frame image is required in the "frame" field')
        try:
            params = parse_detect_params(request.form)
            frame = decode_image(frame_file.read())
        except ValueError as error:
            return error_response(400, str(error))

        started = time.perf_counter()
        detections = detector.detect(frame, params.confidence_threshold)
        inference_ms = round((time.perf_counter() - started) * 1000)

        targets = filter_detections(detections, params.confidence_threshold, params.target_classes)
        events = event_handlers.get(params.session_id, params.cooldown_seconds).process(targets)
        for event in events:
            logger.info("Detection event: %s confidence=%.2f session=%s", event.class_name, event.confidence, params.session_id)

        height, width = frame.shape[:2]
        return jsonify(
            {
                "detections": [d.to_dict(target=d.class_name in params.target_classes) for d in detections],
                "events": [e.to_dict(target=True) for e in events],
                "frameWidth": width,
                "frameHeight": height,
                "inferenceMs": inference_ms,
            }
        )

    @app.errorhandler(413)
    def too_large(_error):
        return error_response(413, f"Frame is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)")

    @app.errorhandler(Exception)
    def unexpected_error(error):
        if isinstance(error, HTTPException):
            return error_response(error.code, error.description)
        if isinstance(error, ModelLoadError):
            return error_response(503, str(error))
        logger.exception("Unhandled error while processing %s %s", request.method, request.path)
        return error_response(500, "Vision service failed to process the request")

    return app


def main() -> None:
    settings = load_settings()
    logger.info("Detection service starting (model=%s)", settings.model_path)
    if not settings.api_key:
        logger.warning("VISION_API_KEY is not set - the /detect endpoint is unprotected")

    detector = YoloDetector(settings.model_path, settings.max_frame_width)
    # If the model fails to load we keep running: /health reports the reason
    # and the backend shows it in the UI, instead of a silent crash.
    detector.try_load()

    app = create_app(detector, EventHandlerRegistry(), settings.api_key)
    logger.info("Detection service listening on http://%s:%d", settings.host, settings.port)
    # Flask's built-in server with threads is enough for a single-user demo;
    # use waitress/gunicorn for anything bigger.
    app.run(host=settings.host, port=settings.port, threaded=True)


if __name__ == "__main__":
    main()
