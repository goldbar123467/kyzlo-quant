from abc import ABC, abstractmethod
from typing import Optional

from ..models import Signal, Tick


class StrategyBase(ABC):
    """Base class for trading strategies."""

    @abstractmethod
    def on_tick(self, tick: Tick) -> Optional[Signal]:
        """Process an incoming tick and optionally emit a Signal."""
        raise NotImplementedError
