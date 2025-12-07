from dataclasses import dataclass
from typing import Literal, Optional
from uuid import UUID


OrderSide = Literal["BUY", "SELL"]


@dataclass(frozen=True)
class Tick:
    """Represents a market data tick for a single symbol."""

    symbol: str
    price: float
    timestamp: float


@dataclass(frozen=True)
class Signal:
    """Signal produced by a strategy, with deterministic idempotency key."""

    symbol: str
    strategy_id: str
    timestamp: float
    side: OrderSide
    strength: float
    signal_id: UUID


@dataclass
class Order:
    """Order to be submitted to a broker."""

    symbol: str
    side: OrderSide
    quantity: float
    price: Optional[float]
    client_order_id: UUID
    state: str = "PENDING"


@dataclass
class Position:
    """Tracks current holdings for a symbol."""

    symbol: str
    quantity: float = 0.0
    average_price: float = 0.0

    def apply_fill(self, side: OrderSide, quantity: float, price: float) -> None:
        """Update the position with a filled quantity."""
        if side == "BUY":
            total_cost = self.average_price * self.quantity + price * quantity
            self.quantity += quantity
            self.average_price = total_cost / self.quantity if self.quantity else 0.0
        else:
            self.quantity -= quantity
            if self.quantity <= 0:
                self.quantity = 0.0
                self.average_price = 0.0
