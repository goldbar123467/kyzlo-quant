import pytest

from src.domain.models import Position, Signal, Tick
from src.domain.risk.kill_switch import KillSwitch, KillSwitchEngaged
from src.domain.risk.rules import MaxPositionRule, RiskViolation
from src.domain.strategy.golden_cross import GoldenCrossStrategy
from src.infrastructure.idempotency import generate_signal_id


def test_position_apply_fill_buy_and_sell():
    position = Position(symbol="AAPL")
    position.apply_fill("BUY", 10, 100)
    assert position.quantity == 10
    assert position.average_price == 100

    position.apply_fill("SELL", 5, 110)
    assert position.quantity == 5
    assert position.average_price == 100

    position.apply_fill("SELL", 5, 90)
    assert position.quantity == 0
    assert position.average_price == 0


def test_kill_switch_triggers_on_loss():
    kill_switch = KillSwitch(daily_loss_limit=100)
    with pytest.raises(KillSwitchEngaged):
        kill_switch.check(pnl=-200, broker_connected=True)


def test_risk_rules_enforced():
    positions = [Position(symbol="AAPL", quantity=100, average_price=100)]
    signal = Signal(
        symbol="AAPL",
        strategy_id="strat",
        timestamp=1.0,
        side="BUY",
        strength=1.0,
        signal_id=generate_signal_id("AAPL", "strat", 1.0),
    )
    rule = MaxPositionRule(symbol="AAPL", max_quantity=100)
    with pytest.raises(RiskViolation):
        rule.evaluate(positions, signal)


@pytest.mark.parametrize("prices,expected_side", [([1, 2, 3, 4, 5], "BUY"), ([5, 4, 3, 2, 1], "SELL")])
def test_golden_cross_direction(prices, expected_side):
    strat = GoldenCrossStrategy("gc", id_generator=generate_signal_id)
    signal = None
    for idx, price in enumerate(prices, start=1):
        tick = Tick("AAPL", price, float(idx))
        signal = strat.on_tick(tick)
    assert signal is not None
    assert signal.side == expected_side


def test_idempotency_key_deterministic():
    key1 = generate_signal_id("AAPL", "gc", 1.0)
    key2 = generate_signal_id("AAPL", "gc", 1.0)
    assert key1 == key2
