import pytest
from uuid import uuid4

from src.application.position_tracker import PositionTracker
from src.domain.events import FillEvent


def test_position_tracker_pnl_calculations():
    tracker = PositionTracker()

    tracker.handle_fill(
        FillEvent(symbol="AAPL", side="BUY", quantity=10, price=100.0, client_order_id=uuid4())
    )
    tracker.update_market_price("AAPL", 110.0)

    position = tracker.get_position("AAPL")
    assert position.quantity == 10
    assert position.average_price == 100.0
    assert tracker.get_realized_pnl() == 0.0
    assert tracker.get_unrealized_pnl() == pytest.approx(100.0)
    assert tracker.get_total_pnl() == pytest.approx(100.0)

    tracker.handle_fill(
        FillEvent(symbol="AAPL", side="SELL", quantity=5, price=120.0, client_order_id=uuid4())
    )

    assert tracker.get_realized_pnl() == pytest.approx(100.0)
    assert tracker.get_unrealized_pnl() == pytest.approx(100.0)
    assert tracker.get_total_pnl() == pytest.approx(200.0)

    position_after_sell = tracker.get_position("AAPL")
    assert position_after_sell.quantity == 5
    assert position_after_sell.average_price == 100.0


def test_position_tracker_handles_multiple_symbols():
    tracker = PositionTracker()

    tracker.handle_fill(
        FillEvent(symbol="AAPL", side="BUY", quantity=10, price=100.0, client_order_id=uuid4())
    )
    tracker.handle_fill(
        FillEvent(symbol="MSFT", side="BUY", quantity=5, price=200.0, client_order_id=uuid4())
    )

    tracker.update_market_price("AAPL", 110.0)
    tracker.update_market_price("MSFT", 190.0)

    positions = tracker.get_positions()
    assert {p.symbol for p in positions} == {"AAPL", "MSFT"}

    assert tracker.get_realized_pnl() == 0.0
    assert tracker.get_unrealized_pnl() == pytest.approx(50.0)
    assert tracker.get_total_pnl() == pytest.approx(50.0)
