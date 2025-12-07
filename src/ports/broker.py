from abc import ABC, abstractmethod

from ..domain.events import FillEvent, OrderEvent


class BrokerPort(ABC):
    """Abstract broker interface."""

    @abstractmethod
    async def submit_order(self, order: OrderEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    async def cancel_order(self, client_order_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def stream_fills(self) -> FillEvent:
        raise NotImplementedError
