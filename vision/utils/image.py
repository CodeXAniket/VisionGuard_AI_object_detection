"""Small OpenCV/NumPy helpers for turning bytes into frames and back."""
import cv2
import numpy as np

TARGET_COLOR = (68, 68, 239)  # BGR red: monitored objects
OTHER_COLOR = (248, 189, 56)  # BGR sky blue: everything else


def decode_image(data: bytes) -> np.ndarray:
    """JPEG/PNG bytes -> BGR NumPy array of shape (height, width, 3)."""
    buffer = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image data (expected JPEG or PNG)")
    return frame


def encode_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Could not encode frame as JPEG")
    return buffer.tobytes()


def resize_frame(frame: np.ndarray, max_width: int) -> tuple[np.ndarray, float]:
    """Downscale wide frames to `max_width` (keeping aspect ratio).

    Returns the frame and the scale factor used, so bounding boxes found on
    the small frame can be mapped back to the original size.
    """
    height, width = frame.shape[:2]
    if width <= max_width:
        return frame, 1.0
    scale = max_width / width
    resized = cv2.resize(frame, (max_width, round(height * scale)), interpolation=cv2.INTER_AREA)
    return resized, scale


def draw_detections(frame: np.ndarray, detections, target_classes: set[str]) -> np.ndarray:
    """Returns a copy of the frame with bounding boxes and labels drawn on it."""
    annotated = frame.copy()
    for detection in detections:
        x1, y1, x2, y2 = detection.bbox
        color = TARGET_COLOR if detection.class_name in target_classes else OTHER_COLOR
        label = f"{detection.class_name} {detection.confidence:.0%}"
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        (text_width, text_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_top = max(0, y1 - text_height - 6)
        cv2.rectangle(annotated, (x1, label_top), (x1 + text_width + 6, label_top + text_height + 6), color, -1)
        cv2.putText(annotated, label, (x1 + 3, label_top + text_height + 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    return annotated
