import structlog
from structlog.stdlib import BoundLogger


def get_logger(name: str) -> BoundLogger:
    """Return a structlog bound logger for the given module name."""

    return structlog.get_logger(name)
