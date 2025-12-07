import asyncio
from collections import defaultdict
from typing import Any, Awaitable, Callable, DefaultDict, List, Type


class EventBus:
    """Async event bus for pub/sub communication."""

    def __init__(self) -> None:
        self._handlers: DefaultDict[Type[Any], List[Callable[[Any], Awaitable[None]]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def subscribe(self, event_type: Type[Any], handler: Callable[[Any], Awaitable[None]]) -> None:
        async with self._lock:
            self._handlers[event_type].append(handler)

    async def publish(self, event: Any) -> None:
        handlers = list(self._handlers[type(event)])
        for handler in handlers:
            await handler(event)
