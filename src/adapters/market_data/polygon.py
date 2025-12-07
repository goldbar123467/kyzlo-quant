import asyncio
from collections import defaultdict, deque
from typing import Awaitable, Callable, DefaultDict, Deque, Dict, List

from ...domain.events import TickEvent
from ...ports.market_data import MarketDataPort


class PolygonStream(MarketDataPort):
    """Simulated Polygon market data stream using ring buffers."""

    def __init__(self, api_key: str, websocket_url: str) -> None:
        self.api_key = api_key
        self.websocket_url = websocket_url
        self._handlers: Dict[str, Callable[[TickEvent], Awaitable[None]]] = {}
        self._buffers: DefaultDict[str, Deque[TickEvent]] = defaultdict(lambda: deque(maxlen=1))
        self._queue: asyncio.Queue[TickEvent] = asyncio.Queue()
        self._running = False

    async def subscribe(self, symbol: str, handler: Callable[[TickEvent], Awaitable[None]]) -> None:
        self._handlers[symbol] = handler

    async def start(self) -> None:
        self._running = True
        while self._running:
            event = await self._queue.get()
            buffer = self._buffers[event.symbol]
            buffer.append(event)
            latest = buffer[-1]
            handler = self._handlers.get(event.symbol)
            if handler:
                await handler(latest)
            self._queue.task_done()

    async def emit(self, event: TickEvent) -> None:
        """Inject a tick event (used in tests)."""
        await self._queue.put(event)

    def stop(self) -> None:
        self._running = False
