from collections import deque
from typing import Callable, Deque, Optional

from ..models import OrderSide, Signal, Tick
from .base import StrategyBase


class GoldenCrossStrategy(StrategyBase):
    """Minimal moving average crossover strategy for demonstration."""

    def __init__(
        self,
        strategy_id: str,
        short_window: int = 3,
        long_window: int = 5,
        id_generator: Optional[Callable[[str, str, float], object]] = None,
    ) -> None:
        self.strategy_id = strategy_id
        self.short_window = short_window
        self.long_window = long_window
        self.id_generator = id_generator
        self._short: Deque[float] = deque(maxlen=short_window)
        self._long: Deque[float] = deque(maxlen=long_window)

    def on_tick(self, tick: Tick) -> Optional[Signal]:
        self._short.append(tick.price)
        self._long.append(tick.price)
        if len(self._short) < self.short_window or len(self._long) < self.long_window:
            return None
        short_avg = sum(self._short) / len(self._short)
        long_avg = sum(self._long) / len(self._long)
        side: OrderSide = "BUY" if short_avg > long_avg else "SELL"
        if not self.id_generator:
            raise RuntimeError("id_generator must be provided for deterministic signals")
        signal_id = self.id_generator(tick.symbol, self.strategy_id, tick.timestamp)
        return Signal(
            symbol=tick.symbol,
            strategy_id=self.strategy_id,
            timestamp=tick.timestamp,
            side=side,
            strength=abs(short_avg - long_avg),
            signal_id=signal_id,
        )
