"""Position tracking and P&L calculation utilities."""

from __future__ import annotations

from typing import Dict, Tuple

from ..domain.events import FillEvent
from ..domain.models import Position


class PositionTracker:
    """Tracks positions and P&L across symbols based on fill events."""

    def __init__(self) -> None:
        self._positions: Dict[str, Position] = {}
        self._last_prices: Dict[str, float] = {}
        self._realized_pnl: float = 0.0

    def handle_fill(self, fill: FillEvent) -> None:
        """Ingest a FillEvent and update positions and realized P&L."""

        position = self._positions.setdefault(fill.symbol, Position(symbol=fill.symbol))
        if fill.side == "SELL":
            self._realized_pnl += (fill.price - position.average_price) * fill.quantity
        position.apply_fill(fill.side, fill.quantity, fill.price)
        self._last_prices[fill.symbol] = fill.price

    def update_market_price(self, symbol: str, price: float) -> None:
        """Update the latest observed market price for unrealized P&L."""

        self._last_prices[symbol] = price

    def get_position(self, symbol: str) -> Position:
        """Return the Position for a symbol, creating it if missing."""

        return self._positions.setdefault(symbol, Position(symbol=symbol))

    def get_positions(self) -> Tuple[Position, ...]:
        """Return an immutable snapshot of current positions."""

        return tuple(self._positions.values())

    def get_realized_pnl(self) -> float:
        """Return realized P&L accumulated from closed quantities."""

        return self._realized_pnl

    def get_unrealized_pnl(self) -> float:
        """Return mark-to-market P&L based on latest prices."""

        pnl = 0.0
        for symbol, position in self._positions.items():
            last_price = self._last_prices.get(symbol)
            if last_price is None:
                continue
            pnl += (last_price - position.average_price) * position.quantity
        return pnl

    def get_total_pnl(self) -> float:
        """Return total P&L combining realized and unrealized components."""

        return self._realized_pnl + self.get_unrealized_pnl()
