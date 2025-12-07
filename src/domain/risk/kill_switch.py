from dataclasses import dataclass
from typing import Optional


class KillSwitchEngaged(Exception):
    """Raised when trading must be halted."""


@dataclass
class KillSwitch:
    """Kill switch checks multiple guardrails to halt trading."""

    daily_loss_limit: float
    broker_disconnected_seconds: int = 0
    manual_triggered: bool = False

    def check(self, pnl: float, broker_connected: bool) -> None:
        if -pnl > self.daily_loss_limit:
            raise KillSwitchEngaged("Daily loss limit exceeded")
        if not broker_connected and self.broker_disconnected_seconds > 60:
            raise KillSwitchEngaged("Broker disconnected for over 60 seconds")
        if self.manual_triggered:
            raise KillSwitchEngaged("Manual halt triggered")

    def trigger_manual(self) -> None:
        self.manual_triggered = True
