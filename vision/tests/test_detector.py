from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from detector import Detection, ModelLoadError, YoloDetector, filter_detections, parse_results
from utils.image import decode_image, resize_frame

NAMES = {0: "person", 2: "car", 67: "cell phone"}


class FakeBoxes:
    """Mimics `Results.boxes`: NumPy arrays instead of PyTorch tensors."""

    def __init__(self, xyxy, conf, cls):
        self.xyxy = np.array(xyxy, dtype=np.float32).reshape(-1, 4)
        self.conf = np.array(conf, dtype=np.float32)
        self.cls = np.array(cls, dtype=np.float32)

    def __len__(self):
        return len(self.conf)


def fake_result(xyxy, conf, cls):
    """Mimics the parts of an Ultralytics `Results` object that parse_results reads."""
    return SimpleNamespace(boxes=FakeBoxes(xyxy, conf, cls), names=NAMES)


class TestParseResults:
    def test_extracts_class_confidence_and_bbox(self):
        result = fake_result([[10.4, 20.6, 110.2, 220.9]], [0.91], [0])
        [detection] = parse_results(result)
        assert detection == Detection(class_id=0, class_name="person", confidence=pytest.approx(0.91), bbox=(10, 21, 110, 221))

    def test_maps_boxes_back_to_original_frame_size(self):
        # Inference ran on a frame downscaled by 0.5 -> coordinates must double.
        result = fake_result([[50, 50, 100, 100]], [0.8], [2])
        [detection] = parse_results(result, scale=0.5)
        assert detection.bbox == (100, 100, 200, 200)
        assert detection.class_name == "car"

    def test_returns_empty_list_when_nothing_found(self):
        assert parse_results(fake_result([], [], [])) == []
        assert parse_results(SimpleNamespace(boxes=None, names=NAMES)) == []

    def test_to_dict_uses_api_field_names(self):
        detection = Detection(67, "cell phone", 0.87654, (1, 2, 3, 4))
        assert detection.to_dict(target=True) == {
            "class": "cell phone",
            "classId": 67,
            "confidence": 0.8765,
            "bbox": [1, 2, 3, 4],
            "target": True,
        }


class TestFilterDetections:
    detections = [
        Detection(0, "person", 0.92, (0, 0, 1, 1)),
        Detection(0, "person", 0.40, (0, 0, 1, 1)),
        Detection(2, "car", 0.75, (0, 0, 1, 1)),
    ]

    def test_filters_by_confidence_threshold(self):
        kept = filter_detections(self.detections, min_confidence=0.5)
        assert [d.confidence for d in kept] == [0.92, 0.75]

    def test_threshold_is_inclusive(self):
        assert len(filter_detections(self.detections, min_confidence=0.75)) == 2

    def test_filters_by_target_classes(self):
        kept = filter_detections(self.detections, min_confidence=0.5, target_classes={"car"})
        assert [d.class_name for d in kept] == ["car"]

    def test_no_targets_selected_means_no_matches(self):
        assert filter_detections(self.detections, min_confidence=0.1, target_classes=set()) == []


class TestImageHelpers:
    def test_resize_keeps_aspect_ratio_and_returns_scale(self):
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        resized, scale = resize_frame(frame, 640)
        assert resized.shape == (360, 640, 3)
        assert scale == 0.5

    def test_small_frames_are_not_upscaled(self):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        resized, scale = resize_frame(frame, 640)
        assert resized is frame and scale == 1.0

    def test_decode_image_round_trip(self):
        ok, jpeg = cv2.imencode(".jpg", np.full((48, 64, 3), 127, dtype=np.uint8))
        assert ok
        assert decode_image(jpeg.tobytes()).shape == (48, 64, 3)

    def test_decode_image_rejects_garbage(self):
        with pytest.raises(ValueError):
            decode_image(b"definitely not a jpeg")


class TestYoloDetector:
    def test_missing_model_file_raises_clear_error(self):
        detector = YoloDetector("models/does-not-exist.pt")
        with pytest.raises(ModelLoadError, match="Model file not found"):
            detector.load()

    def test_try_load_records_the_error(self):
        detector = YoloDetector("models/does-not-exist.pt")
        assert detector.try_load() is False
        assert "not found" in detector.load_error
        assert not detector.is_loaded

    def test_detect_without_model_raises(self):
        with pytest.raises(ModelLoadError):
            YoloDetector("yolov8n.pt").detect(np.zeros((10, 10, 3), dtype=np.uint8))
