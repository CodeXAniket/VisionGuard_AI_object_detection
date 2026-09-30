"""OpenCV camera access for the standalone local monitor (local_monitor.py).

In the web app the *browser* owns the webcam; this module is used when the
Python side reads a camera (or video file / RTSP stream) directly.
"""
import cv2
import numpy as np

from utils.logger import get_logger

logger = get_logger("camera")


class CameraError(RuntimeError):
    """The camera could not be opened or stopped delivering frames."""


def parse_source(source: str) -> int | str:
    """"0" -> 0 (webcam index); anything else (file path, rtsp://...) is kept as a string."""
    return int(source) if source.isdigit() else source


class Camera:
    """Wraps cv2.VideoCapture and guarantees the device is released.

    Use as a context manager:
        with Camera(0) as camera:
            frame = camera.read()
    """

    def __init__(self, source: int | str = 0):
        self.source = source
        self._capture: cv2.VideoCapture | None = None

    def open(self) -> "Camera":
        self._capture = cv2.VideoCapture(self.source)
        if not self._capture.isOpened():
            self._capture.release()
            self._capture = None
            raise CameraError(
                f"Could not open camera '{self.source}'. Check that it is connected, "
                "not used by another application, and that camera access is allowed."
            )
        width = int(self._capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self._capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        logger.info("Camera initialized: source=%s resolution=%dx%d", self.source, width, height)
        return self

    def read(self) -> np.ndarray:
        if self._capture is None:
            raise CameraError("Camera is not open")
        ok, frame = self._capture.read()
        if not ok or frame is None:
            raise CameraError("Failed to read a frame (camera disconnected or end of video)")
        return frame

    def release(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
            logger.info("Camera released")

    def __enter__(self) -> "Camera":
        return self.open()

    def __exit__(self, *exc_info) -> None:
        self.release()
