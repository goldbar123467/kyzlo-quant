from dataclasses import dataclass
from typing import Iterable

from ..models import Order, Position, Signal


class RiskViolation(Exception):
    """Raised when a risk rule fails."""


@dataclass(frozen=True)
class MaxPositionRule:
    symbol: str
    max_quantity: float

    def evaluate(self, positions: Iterable[Position], signal: Signal) -> None:
        for position in positions:
            if position.symbol == self.symbol:
                if position.quantity >= self.max_quantity and signal.side == "BUY":
                    raise RiskViolation(f"Max position exceeded for {self.symbol}")


@dataclass(frozen=True)
class MaxNotionalRule:
    max_notional: float

    def evaluate(self, positions: Iterable[Position], signal: Signal) -> None:
        notional = sum(p.average_price * p.quantity for p in positions)
        if notional > self.max_notional:
            raise RiskViolation("Max notional exposure exceeded")


def evaluate_risk(rules: Iterable[object], positions: Iterable[Position], signal: Signal) -> None:
    for rule in rules:
        if hasattr(rule, "evaluate"):
            rule.evaluate(positions, signal)
