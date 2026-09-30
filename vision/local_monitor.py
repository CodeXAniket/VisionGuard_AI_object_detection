"""Standalone monitor: webcam -> YOLO -> OpenCV window, no browser needed.

Useful for testing the detector on its own (Phase 7) and as a second way
of producing events (e.g. a Raspberry Pi with a USB camera).

Examples:
    python local_monitor.py --classes person
    python local_monitor.py --source 0 --classes "person,cell phone" --conf 0.6 --cooldown 10
    python local_monitor.py --classes person --save-dir snapshots
    python local_monitor.py --classes person --post     # needs VISIONGUARD_API_URL + VISIONGUARD_TOKEN

Press "q" in the video window to quit.
"""
import argparse
import os
import sys
import time
from pathlib import Path

import cv2

from camera import Camera, CameraError, parse_source
from detector import ModelLoadError, YoloDetector, filter_detections
from event_handler import EventHandler
from utils.api_client import post_detection_event
from utils.config import load_settings
from utils.image import draw_detections, encode_jpeg
from utils.logger import get_logger

logger = get_logger("local_monitor")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run YOLO on a local camera and report detection events.")
    parser.add_argument("--source", default="0", help="Camera index, video file or stream URL (default: 0)")
    parser.add_argument("--classes", default="person", help='Comma-separated classes to monitor, e.g. "person,dog"')
    parser.add_argument("--conf", type=float, default=0.5, help="Confidence threshold 0-1 (default: 0.5)")
    parser.add_argument("--cooldown", type=float, default=30, help="Seconds between events per class (default: 30)")
    parser.add_argument("--every", type=int, default=2, help="Run YOLO on every Nth frame (default: 2)")
    parser.add_argument("--save-dir", help="Also save event snapshots to this folder")
    parser.add_argument("--post", action="store_true", help="Send events to the VisionGuard API")
    parser.add_argument("--no-window", action="store_true", help="Run headless (no preview window)")
    return parser.parse_args()


def handle_event(event, frame, args, api_config) -> None:
    logger.info("Detection event: %s confidence=%.2f bbox=%s", event.class_name, event.confidence, event.bbox)
    snapshot = encode_jpeg(frame)
    height, width = frame.shape[:2]

    if args.save_dir:
        path = Path(args.save_dir) / f"{int(time.time() * 1000)}_{event.class_name.replace(' ', '_')}.jpg"
        path.write_bytes(snapshot)
        logger.info("Snapshot saved: %s", path)

    if api_config:
        post_detection_event(api_config["url"], api_config["token"], snapshot, event, width, height)


def main() -> int:
    args = parse_args()
    settings = load_settings()
    target_classes = {name.strip() for name in args.classes.split(",") if name.strip()}

    api_config = None
    if args.post:
        api_config = {"url": os.getenv("VISIONGUARD_API_URL", "http://localhost:5000/api"), "token": os.getenv("VISIONGUARD_TOKEN")}
        if not api_config["token"]:
            logger.error("--post needs VISIONGUARD_TOKEN (a JWT from POST /api/auth/login)")
            return 1
    if args.save_dir:
        Path(args.save_dir).mkdir(parents=True, exist_ok=True)

    detector = YoloDetector(settings.model_path, settings.max_frame_width)
    try:
        detector.load()
    except ModelLoadError as error:
        logger.error("%s", error)
        return 1

    unknown = target_classes - set(detector.class_names)
    if unknown:
        logger.error("Unknown classes: %s. The model knows: %s", ", ".join(sorted(unknown)), ", ".join(detector.class_names))
        return 1

    event_handler = EventHandler(cooldown_seconds=args.cooldown)
    logger.info("Monitoring %s (conf >= %.2f, cooldown %ss)", sorted(target_classes), args.conf, args.cooldown)

    try:
        with Camera(parse_source(args.source)) as camera:
            frame_index = 0
            detections = []
            while True:
                frame = camera.read()
                frame_index += 1

                # Skipping frames is the cheapest optimisation: at 30 FPS,
                # analysing every 2nd frame still gives 15 detections/second.
                if frame_index % args.every == 0:
                    detections = detector.detect(frame, args.conf)
                    targets = filter_detections(detections, args.conf, target_classes)
                    for event in event_handler.process(targets):
                        handle_event(event, frame, args, api_config)

                if not args.no_window:
                    cv2.imshow("VisionGuard AI - local monitor (q to quit)", draw_detections(frame, detections, target_classes))
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
    except CameraError as error:
        if os.path.isfile(args.source):
            logger.info("Reached the end of %s", args.source)
            return 0
        logger.error("%s", error)
        return 1
    except KeyboardInterrupt:
        logger.info("Stopped by user")
    finally:
        cv2.destroyAllWindows()

    return 0


if __name__ == "__main__":
    sys.exit(main())
