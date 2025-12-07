from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from .models import OrderSide


@dataclass(frozen=True)
class TickEvent:
    symbol: str
    price: float
    timestamp: float


@dataclass(frozen=True)
class SignalEvent:
    symbol: str
    strategy_id: str
    timestamp: float
    side: OrderSide
    strength: float
    signal_id: UUID


@dataclass(frozen=True)
class OrderEvent:
    symbol: str
    side: OrderSide
    quantity: float
    price: Optional[float]
    client_order_id: UUID


@dataclass(frozen=True)
class FillEvent:
    symbol: str
    side: OrderSide
    quantity: float
    price: float
    client_order_id: UUID
