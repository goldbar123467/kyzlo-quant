import pytest

from src.application.fsm import InvalidOrderState, OrderStateMachine
from src.domain.models import Order
from src.infrastructure.idempotency import generate_signal_id


def test_valid_transitions():
    order = Order(symbol="AAPL", side="BUY", quantity=1, price=None, client_order_id=generate_signal_id("AAPL", "s", 1.0))
    fsm = OrderStateMachine(order)
    fsm.transition("SUBMITTED")
    assert order.state == "SUBMITTED"
    fsm.transition("FILLED")
    assert order.state == "FILLED"


def test_invalid_transition_raises():
    order = Order(symbol="AAPL", side="BUY", quantity=1, price=None, client_order_id=generate_signal_id("AAPL", "s", 1.0))
    fsm = OrderStateMachine(order)
    with pytest.raises(InvalidOrderState):
        fsm.transition("FILLED")
