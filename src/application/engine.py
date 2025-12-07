import asyncio
from collections import defaultdict
from typing import Any, Awaitable, Callable, DefaultDict, Dict

from ..domain.events import TickEvent


class PartitionedEngine:
    """Routes events to symbol specific workers to maintain ordering."""

    def __init__(self) -> None:
        self._queues: DefaultDict[str, asyncio.Queue[TickEvent]] = defaultdict(asyncio.Queue)
        self._workers: Dict[str, asyncio.Task[None]] = {}
        self._handlers: Dict[str, Callable[[TickEvent], Awaitable[None]]] = {}

    def register_handler(self, symbol: str, handler: Callable[[TickEvent], Awaitable[None]]) -> None:
        self._handlers[symbol] = handler
        if symbol not in self._workers:
            self._workers[symbol] = asyncio.create_task(self._worker(symbol))

    async def enqueue(self, event: TickEvent) -> None:
        await self._queues[event.symbol].put(event)

    async def _worker(self, symbol: str) -> None:
        queue = self._queues[symbol]
        handler = self._handlers[symbol]
        while True:
            event = await queue.get()
            await handler(event)
            queue.task_done()
