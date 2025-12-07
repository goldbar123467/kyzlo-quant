from abc import ABC, abstractmethod
from typing import Any


class PersistencePort(ABC):
    """Abstract persistence layer for events."""

    @abstractmethod
    async def persist_event(self, event: Any) -> None:
        raise NotImplementedError
