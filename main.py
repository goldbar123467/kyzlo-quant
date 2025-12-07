import asyncio

from src import config
from src.application.bus import EventBus
from src.application.engine import PartitionedEngine
from src.application.services import ExecutionService, RiskService
from src.domain.events import FillEvent, OrderEvent, SignalEvent, TickEvent
from src.domain.models import Position, Tick
from src.domain.strategy.golden_cross import GoldenCrossStrategy
from src.infrastructure.idempotency import generate_signal_id
from src.infrastructure.logging import get_logger

logger = get_logger(__name__)


async def run() -> None:
    components = config.build_components()
    bus: EventBus = components["bus"]
    engine: PartitionedEngine = components["engine"]
    market_data = components["market_data"]
    persistence = components["persistence"]
    risk_service: RiskService = components["risk_service"]
    execution_service: ExecutionService = components["execution_service"]

    strategy = GoldenCrossStrategy(strategy_id="golden-cross", id_generator=generate_signal_id)
    positions: dict[str, Position] = {"AAPL": Position(symbol="AAPL")}
    broker_connected = True

    async def on_tick(event: TickEvent) -> None:
        tick = Tick(symbol=event.symbol, price=event.price, timestamp=event.timestamp)
        signal = strategy.on_tick(tick)
        if signal:
            signal_event = SignalEvent(
                symbol=signal.symbol,
                strategy_id=signal.strategy_id,
                timestamp=signal.timestamp,
                side=signal.side,
                strength=signal.strength,
                signal_id=signal.signal_id,
            )
            await bus.publish(signal_event)
            await persistence.persist_event(signal_event)

    async def on_signal(event: SignalEvent) -> None:
        try:
            risk_service.validate(event, positions.values(), pnl=0.0, broker_connected=broker_connected)
        except Exception as exc:
            logger.error("risk_validation_failed", error=str(exc))
            return
        order = OrderEvent(
            symbol=event.symbol,
            side=event.side,
            quantity=1,
            price=None,
            client_order_id=event.signal_id,
        )
        await bus.publish(order)
        await persistence.persist_event(order)

    async def on_order(event: OrderEvent) -> None:
        await execution_service.submit(event)

    async def on_fill(event: FillEvent) -> None:
        position = positions.setdefault(event.symbol, Position(symbol=event.symbol))
        position.apply_fill(event.side, event.quantity, event.price)
        await persistence.persist_event(event)

    await bus.subscribe(TickEvent, on_tick)
    await bus.subscribe(SignalEvent, on_signal)
    await bus.subscribe(OrderEvent, on_order)
    await bus.subscribe(FillEvent, on_fill)

    engine.register_handler("AAPL", on_tick)
    await market_data.subscribe("AAPL", engine.enqueue)

    market_task = asyncio.create_task(market_data.start())

    await market_data.emit(TickEvent(symbol="AAPL", price=150.0, timestamp=1.0))
    await market_data.emit(TickEvent(symbol="AAPL", price=151.0, timestamp=2.0))
    await market_data.emit(TickEvent(symbol="AAPL", price=152.0, timestamp=3.0))
    await market_data.emit(TickEvent(symbol="AAPL", price=153.0, timestamp=4.0))
    await asyncio.sleep(0.1)

    market_task.cancel()
    try:
        await market_task
    except asyncio.CancelledError:
        pass


if __name__ == "__main__":
    asyncio.run(run())
