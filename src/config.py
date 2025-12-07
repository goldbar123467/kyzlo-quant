from .domain.risk.kill_switch import KillSwitch
from .domain.risk.rules import MaxNotionalRule, MaxPositionRule
from .ports.broker import BrokerPort
from .ports.market_data import MarketDataPort
from .ports.persistence import PersistencePort
from .ports.fundamentals import FundamentalsPort
from .ports.news import NewsPort
from .adapters.broker.alpaca import AlpacaBroker
from .adapters.market_data.polygon import PolygonStream
from .adapters.persistence.timescale import TimescaleRepository
from .adapters.fundamentals.alpha_vantage import AlphaVantageClient
from .adapters.news.gnews import GNewsClient
from .application.bus import EventBus
from .application.engine import PartitionedEngine
from .application.services import ExecutionService, RiskService


def build_components() -> dict:
    """Construct all platform components for wiring in main.py."""
    bus = EventBus()
    engine = PartitionedEngine()
    market_data: MarketDataPort = PolygonStream()
    broker: BrokerPort = AlpacaBroker()
    persistence: PersistencePort = TimescaleRepository()
    fundamentals: FundamentalsPort = AlphaVantageClient()
    news: NewsPort = GNewsClient()
    kill_switch = KillSwitch(daily_loss_limit=1000.0)
    risk_rules = [MaxPositionRule(symbol="AAPL", max_quantity=100), MaxNotionalRule(max_notional=100000)]
    risk_service = RiskService(kill_switch=kill_switch, rules=risk_rules)
    execution_service = ExecutionService(broker=broker)
    return {
        "bus": bus,
        "engine": engine,
        "market_data": market_data,
        "broker": broker,
        "persistence": persistence,
        "fundamentals": fundamentals,
        "news": news,
        "risk_service": risk_service,
        "execution_service": execution_service,
    }
