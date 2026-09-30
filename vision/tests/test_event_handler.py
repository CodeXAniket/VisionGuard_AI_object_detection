from detector import Detection
from event_handler import EventHandler, EventHandlerRegistry


class FakeClock:
    """Lets tests move time forward without sleeping."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


def person(confidence=0.9):
    return Detection(0, "person", confidence, (0, 0, 10, 10))


def dog(confidence=0.8):
    return Detection(16, "dog", confidence, (0, 0, 10, 10))


def test_first_detection_creates_an_event():
    handler = EventHandler(cooldown_seconds=30, clock=FakeClock())
    assert handler.process([person()]) == [person()]


def test_repeated_detections_during_cooldown_are_ignored():
    clock = FakeClock()
    handler = EventHandler(cooldown_seconds=30, clock=clock)
    handler.process([person()])

    for _ in range(100):  # 100 frames of the same person standing there
        clock.advance(0.25)
        assert handler.process([person()]) == []


def test_new_event_after_cooldown_expires():
    clock = FakeClock()
    handler = EventHandler(cooldown_seconds=30, clock=clock)
    handler.process([person()])

    clock.advance(29.9)
    assert handler.process([person()]) == []
    clock.advance(0.1)
    assert handler.process([person()]) == [person()]


def test_each_class_has_its_own_cooldown():
    clock = FakeClock()
    handler = EventHandler(cooldown_seconds=30, clock=clock)
    handler.process([person()])

    clock.advance(1)
    events = handler.process([person(), dog()])
    assert [e.class_name for e in events] == ["dog"]


def test_one_event_per_class_using_the_most_confident_detection():
    handler = EventHandler(cooldown_seconds=30, clock=FakeClock())
    events = handler.process([person(0.6), person(0.95), person(0.7)])
    assert events == [person(0.95)]


def test_empty_frame_creates_no_events():
    assert EventHandler(clock=FakeClock()).process([]) == []


def test_reset_clears_cooldowns():
    handler = EventHandler(cooldown_seconds=30, clock=FakeClock())
    handler.process([person()])
    handler.reset()
    assert handler.process([person()]) == [person()]


def test_registry_keeps_sessions_independent():
    registry = EventHandlerRegistry(clock=FakeClock())
    registry.get("user-a", 30).process([person()])
    assert registry.get("user-b", 30).process([person()]) == [person()]
    assert registry.get("user-a", 30).process([person()]) == []


def test_registry_applies_updated_cooldown():
    clock = FakeClock()
    registry = EventHandlerRegistry(clock=clock)
    registry.get("user-a", 60).process([person()])

    clock.advance(10)
    # User lowered the cooldown from 60 s to 5 s in their settings.
    assert registry.get("user-a", 5).process([person()]) == [person()]
