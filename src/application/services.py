from typing import Iterable, Optional

from ..domain.events import FillEvent, OrderEvent, SignalEvent
from ..domain.models import Order, Position
from ..domain.risk.kill_switch import KillSwitch, KillSwitchEngaged
from ..domain.risk.rules import RiskViolation, evaluate_risk
from ..ports.broker import BrokerPort


class RiskService:
    """Applies risk checks including kill switch before order submission."""

    def __init__(self, kill_switch: KillSwitch, rules: Iterable[object]) -> None:
        self.kill_switch = kill_switch
        self.rules = list(rules)

    def validate(self, signal: SignalEvent, positions: Iterable[Position], pnl: float, broker_connected: bool) -> None:
        self.kill_switch.check(pnl=pnl, broker_connected=broker_connected)
        evaluate_risk(self.rules, positions, signal)


class ExecutionService:
    """Submits orders through the broker port."""

    def __init__(self, broker: BrokerPort) -> None:
        self.broker = broker

    async def submit(self, order_event: OrderEvent) -> None:
        await self.broker.submit_order(order_event)

    async def cancel(self, client_order_id: str) -> None:
        await self.broker.cancel_order(client_order_id)

    async def listen_fills(self, handler) -> None:
        fill = await self.broker.stream_fills()
        await handler(fill)
