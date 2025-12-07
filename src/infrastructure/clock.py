import time
from typing import Protocol


class Clock(Protocol):
    def now(self) -> float:
        ...


class SystemClock:
    """Production clock using time.time()."""

    def now(self) -> float:
        return time.time()


class FixedClock:
    """Deterministic clock for tests."""

    def __init__(self, value: float) -> None:
        self.value = value

    def now(self) -> float:
        return self.value
