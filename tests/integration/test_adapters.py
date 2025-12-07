import asyncio

import pytest

from src.adapters.broker.alpaca import AlpacaBroker
from src.adapters.market_data.polygon import PolygonStream
from src.config import load_settings
from src.domain.events import FillEvent, OrderEvent, TickEvent


@pytest.mark.integration
def test_polygon_stream_uses_ring_buffer_latest_only():
    async def _run() -> None:
        received = []

        async def handler(event: TickEvent) -> None:
            received.append(event.price)

        settings = load_settings()
        stream = PolygonStream(
            api_key=settings.polygon.api_key, websocket_url=settings.polygon.websocket_url
        )
        await stream.subscribe("AAPL", handler)
        task = asyncio.create_task(stream.start())
        await stream.emit(TickEvent(symbol="AAPL", price=1.0, timestamp=1.0))
        await stream.emit(TickEvent(symbol="AAPL", price=2.0, timestamp=2.0))
        await asyncio.sleep(0.05)
        stream.stop()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert received[-1] == 2.0

    asyncio.run(_run())


@pytest.mark.integration
def test_alpaca_broker_records_orders_and_fills():
    async def _run() -> None:
        settings = load_settings()
        broker = AlpacaBroker(
            api_key=settings.alpaca.api_key,
            api_secret=settings.alpaca.api_secret,
            base_url=settings.alpaca.base_url,
        )
        order_event = OrderEvent(symbol="AAPL", side="BUY", quantity=1, price=None, client_order_id=1)
        await broker.submit_order(order_event)
        assert broker.submitted[0].symbol == "AAPL"

        fill = FillEvent(symbol="AAPL", side="BUY", quantity=1, price=1.0, client_order_id=order_event.client_order_id)
        await broker.push_fill(fill)
        received = await broker.stream_fills()
        assert received.price == 1.0

    asyncio.run(_run())
