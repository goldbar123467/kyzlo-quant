import asyncio

from ...domain.events import FillEvent, OrderEvent
from ...ports.broker import BrokerPort


class AlpacaBroker(BrokerPort):
    """Lightweight simulated Alpaca broker adapter."""

    def __init__(self, api_key: str, api_secret: str, base_url: str) -> None:
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self._fills: asyncio.Queue[FillEvent] = asyncio.Queue()
        self.submitted: list[OrderEvent] = []
        self.cancelled: list[str] = []

    async def submit_order(self, order: OrderEvent) -> None:
        self.submitted.append(order)

    async def cancel_order(self, client_order_id: str) -> None:
        self.cancelled.append(client_order_id)

    async def stream_fills(self) -> FillEvent:
        return await self._fills.get()

    async def push_fill(self, fill: FillEvent) -> None:
        await self._fills.put(fill)
