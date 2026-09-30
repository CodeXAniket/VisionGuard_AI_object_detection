import logging

_configured = False


def get_logger(name: str) -> logging.Logger:
    """Returns a logger that prints lines like: 2026-09-27 10:00:00 [INFO] detector: YOLO model loaded"""
    global _configured
    if not _configured:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        # Flask's dev server logs every request; at several frames per second
        # that would bury the useful lines, so only show its warnings.
        logging.getLogger("werkzeug").setLevel(logging.WARNING)
        _configured = True
    return logging.getLogger(name)
