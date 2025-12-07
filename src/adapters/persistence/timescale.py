from typing import Any, List

from ...ports.persistence import PersistencePort


class TimescaleRepository(PersistencePort):
    """In-memory persistence stub mimicking Timescale writes."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.events: List[Any] = []

    async def persist_event(self, event: Any) -> None:
        self.events.append(event)
