"""Turns a stream of per-frame detections into a small number of *events*.

YOLO runs several times per second, so a person standing in front of the
camera is "detected" hundreds of times a minute. Only the first sighting is
interesting. The rule used here:

    A monitored object creates an event only if no event for the same
    object class was created in the last `cooldown_seconds`.

    frame 1  person 0.91  -> EVENT (no previous event)
    frame 2  person 0.93  -> ignored (cooldown active)
    ...
    +30 s    person 0.90  -> EVENT (cooldown expired)

Each class has its own cooldown, so a "dog" event isn't blocked by a recent
"person" event.
"""
import threading
import time
from typing import Callable

from detector import Detection


class EventHandler:
    def __init__(self, cooldown_seconds: float = 30.0, clock: Callable[[], float] = time.monotonic):
        self.cooldown_seconds = cooldown_seconds
        # Injectable clock so tests can control time. time.monotonic is used
        # because it never jumps backwards (unlike wall-clock time).
        self._clock = clock
        self._last_event_at: dict[str, float] = {}

    def is_cooling_down(self, class_name: str, now: float | None = None) -> bool:
        last = self._last_event_at.get(class_name)
        if last is None:
            return False
        now = self._clock() if now is None else now
        return (now - last) < self.cooldown_seconds

    def process(self, detections: list[Detection]) -> list[Detection]:
        """Returns the detections that should become new events (at most one per class).

        `detections` should already be filtered to monitored classes above the
        confidence threshold. If a class appears several times in one frame
        (e.g. two people), the most confident detection represents the event.
        """
        now = self._clock()

        best_per_class: dict[str, Detection] = {}
        for detection in detections:
            current = best_per_class.get(detection.class_name)
            if current is None or detection.confidence > current.confidence:
                best_per_class[detection.class_name] = detection

        events = []
        for class_name, detection in best_per_class.items():
            if self.is_cooling_down(class_name, now):
                continue
            self._last_event_at[class_name] = now
            events.append(detection)
        return events

    def reset(self) -> None:
        self._last_event_at.clear()


class EventHandlerRegistry:
    """Keeps one EventHandler per monitoring session (one per user), so two
    users watching different cameras never share cooldowns."""

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self._clock = clock
        self._handlers: dict[str, EventHandler] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str, cooldown_seconds: float) -> EventHandler:
        with self._lock:
            handler = self._handlers.get(session_id)
            if handler is None:
                handler = EventHandler(cooldown_seconds, self._clock)
                self._handlers[session_id] = handler
            # The user may have changed the cooldown in their settings.
            handler.cooldown_seconds = cooldown_seconds
            return handler
