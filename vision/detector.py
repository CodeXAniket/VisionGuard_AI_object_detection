"""YOLO object detection.

This project uses a *pretrained* Ultralytics YOLO model (trained on the
80-class COCO dataset). No custom training is done here - this module loads
the model, runs inference on frames and converts the raw output into plain
Python objects that the rest of the system can use.
"""
import os
import threading
from dataclasses import dataclass

import numpy as np

from utils.image import resize_frame
from utils.logger import get_logger

logger = get_logger("detector")


class ModelLoadError(RuntimeError):
    """The YOLO model could not be loaded (missing file, bad weights, ultralytics not installed)."""


@dataclass(frozen=True)
class Detection:
    class_id: int
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]  # (x1, y1, x2, y2) in pixels of the original frame

    def to_dict(self, target: bool = False) -> dict:
        return {
            "class": self.class_name,
            "classId": self.class_id,
            "confidence": round(self.confidence, 4),
            "bbox": list(self.bbox),
            "target": target,
        }


def _to_numpy(values) -> np.ndarray:
    # Ultralytics returns PyTorch tensors (possibly on the GPU); tests pass NumPy arrays.
    return values.cpu().numpy() if hasattr(values, "cpu") else np.asarray(values)


def parse_results(result, scale: float = 1.0) -> list[Detection]:
    """Converts one Ultralytics `Results` object into a list of Detection.

    result.boxes.xyxy -> (N, 4) box corners
    result.boxes.conf -> (N,)   confidence scores
    result.boxes.cls  -> (N,)   class ids, mapped to names via result.names

    `scale` is the resize factor applied before inference; dividing by it maps
    the boxes back onto the original frame.
    """
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return []

    corners = _to_numpy(boxes.xyxy) / scale
    confidences = _to_numpy(boxes.conf)
    class_ids = _to_numpy(boxes.cls).astype(int)

    detections = []
    for (x1, y1, x2, y2), confidence, class_id in zip(corners, confidences, class_ids):
        detections.append(
            Detection(
                class_id=int(class_id),
                class_name=result.names[int(class_id)],
                confidence=float(confidence),
                bbox=(int(round(x1)), int(round(y1)), int(round(x2)), int(round(y2))),
            )
        )
    return detections


def filter_detections(detections: list[Detection], min_confidence: float, target_classes=None) -> list[Detection]:
    """Keeps detections at or above `min_confidence`, and (if given) only the target classes."""
    return [
        d
        for d in detections
        if d.confidence >= min_confidence and (target_classes is None or d.class_name in target_classes)
    ]


class YoloDetector:
    def __init__(self, model_path: str, max_frame_width: int = 640):
        self.model_path = model_path
        self.max_frame_width = max_frame_width
        self.load_error: str | None = None
        self._model = None
        # One model instance is shared by all request threads; inference is
        # serialised because PyTorch models aren't guaranteed to be thread-safe.
        self._lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def class_names(self) -> list[str]:
        return [self._model.names[i] for i in sorted(self._model.names)] if self._model else []

    def load(self) -> None:
        """Loads the weights and runs one warm-up inference. Raises ModelLoadError."""
        try:
            from ultralytics import YOLO  # imported lazily: heavy, and not needed by the unit tests
        except ImportError as error:
            raise ModelLoadError("ultralytics is not installed. Run: pip install -r requirements.txt") from error

        # A bare name like "yolov8n.pt" is downloaded automatically by Ultralytics;
        # a path (e.g. "models/custom.pt") must already exist.
        is_path = os.sep in self.model_path or "/" in self.model_path
        if is_path and not os.path.isfile(self.model_path):
            raise ModelLoadError(f"Model file not found: {self.model_path}")

        try:
            model = YOLO(self.model_path)
            # The first inference is slow (memory allocation, lazy init).
            # Doing it now keeps the first real frame fast.
            model.predict(np.zeros((self.max_frame_width, self.max_frame_width, 3), dtype=np.uint8), verbose=False)
        except Exception as error:  # ultralytics raises many different error types
            raise ModelLoadError(f"Could not load YOLO model '{self.model_path}': {error}") from error

        self._model = model
        self.load_error = None
        logger.info("YOLO model loaded: %s (%d classes)", self.model_path, len(model.names))

    def try_load(self) -> bool:
        """Like load(), but records the error instead of raising (used by the HTTP service)."""
        try:
            self.load()
            return True
        except ModelLoadError as error:
            self.load_error = str(error)
            logger.error("%s", error)
            return False

    def detect(self, frame: np.ndarray, min_confidence: float = 0.25) -> list[Detection]:
        """Runs YOLO on a BGR frame and returns every detection above `min_confidence`."""
        if self._model is None:
            raise ModelLoadError(self.load_error or "YOLO model is not loaded")

        resized, scale = resize_frame(frame, self.max_frame_width)
        with self._lock:
            # `conf` makes YOLO drop weak boxes itself, before non-max suppression.
            results = self._model.predict(resized, conf=min_confidence, verbose=False)
        return parse_results(results[0], scale)
