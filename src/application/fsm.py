from dataclasses import dataclass
from typing import Dict

from ..domain.models import Order


class InvalidOrderState(Exception):
    """Raised when an invalid state transition is attempted."""


VALID_TRANSITIONS: Dict[str, set[str]] = {
    "PENDING": {"SUBMITTED"},
    "SUBMITTED": {"FILLED", "REJECTED", "PARTIALLY_FILLED", "CANCEL_PENDING"},
    "PARTIALLY_FILLED": {"FILLED"},
    "CANCEL_PENDING": {"CANCELLED"},
}


@dataclass
class OrderStateMachine:
    order: Order

    def transition(self, new_state: str) -> None:
        allowed = VALID_TRANSITIONS.get(self.order.state, set())
        if new_state not in allowed:
            raise InvalidOrderState(f"Cannot transition from {self.order.state} to {new_state}")
        self.order.state = new_state
