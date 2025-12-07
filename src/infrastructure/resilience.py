import asyncio
from typing import Callable, TypeVar

T = TypeVar("T")


class CircuitBreaker:
    """Simple circuit breaker to guard external calls."""

    def __init__(self, max_failures: int = 5, reset_timeout: float = 60.0) -> None:
        self.max_failures = max_failures
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.open = False

    async def call(self, func: Callable[[], T]) -> T:
        if self.open:
            raise RuntimeError("Circuit open")
        try:
            result = func()
            self.failures = 0
            return result
        except Exception:
            self.failures += 1
            if self.failures >= self.max_failures:
                self.open = True
                await asyncio.sleep(self.reset_timeout)
                self.open = False
            raise
