from abc import ABC, abstractmethod
from typing import Awaitable, Callable

from ..domain.events import TickEvent


class MarketDataPort(ABC):
    """Abstract interface for consuming market data."""

    @abstractmethod
    async def subscribe(self, symbol: str, handler: Callable[[TickEvent], Awaitable[None]]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def start(self) -> None:
        raise NotImplementedError
