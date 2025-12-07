import os
from dataclasses import dataclass

from .adapters.broker.alpaca import AlpacaBroker
from .adapters.fundamentals.alpha_vantage import AlphaVantageClient
from .adapters.market_data.polygon import PolygonStream
from .adapters.news.gnews import GNewsClient
from .adapters.persistence.timescale import TimescaleRepository
from .application.bus import EventBus
from .application.engine import PartitionedEngine
from .application.services import ExecutionService, RiskService
from .domain.risk.kill_switch import KillSwitch
from .domain.risk.rules import MaxNotionalRule, MaxPositionRule
from .ports.broker import BrokerPort
from .ports.fundamentals import FundamentalsPort
from .ports.market_data import MarketDataPort
from .ports.news import NewsPort
from .ports.persistence import PersistencePort


@dataclass
class AlpacaSettings:
    api_key: str
    api_secret: str
    base_url: str


@dataclass
class PolygonSettings:
    api_key: str
    websocket_url: str


@dataclass
class AlphaVantageSettings:
    api_key: str
    base_url: str


@dataclass
class GNewsSettings:
    api_key: str
    endpoint: str


@dataclass
class TimescaleSettings:
    dsn: str


@dataclass
class RiskSettings:
    daily_loss_limit: float
    max_notional: float
    max_position_symbol: str
    max_position_quantity: int


@dataclass
class Settings:
    alpaca: AlpacaSettings
    polygon: PolygonSettings
    alpha_vantage: AlphaVantageSettings
    gnews: GNewsSettings
    timescale: TimescaleSettings
    risk: RiskSettings


def _env(key: str, default: str) -> str:
    return os.getenv(key, default)


def load_settings() -> Settings:
    """Load environment-driven settings with safe defaults for local runs."""

    return Settings(
        alpaca=AlpacaSettings(
            api_key=_env("ALPACA_API_KEY", "your-alpaca-api-key"),
            api_secret=_env("ALPACA_API_SECRET", "your-alpaca-api-secret"),
            base_url=_env("ALPACA_BASE_URL", "https://paper-api.alpaca.markets"),
        ),
        polygon=PolygonSettings(
            api_key=_env("POLYGON_API_KEY", "your-polygon-api-key"),
            websocket_url=_env("POLYGON_WEBSOCKET_URL", "wss://socket.polygon.io/stocks"),
        ),
        alpha_vantage=AlphaVantageSettings(
            api_key=_env("ALPHA_VANTAGE_API_KEY", "your-alpha-vantage-key"),
            base_url=_env("ALPHA_VANTAGE_BASE_URL", "https://www.alphavantage.co"),
        ),
        gnews=GNewsSettings(
            api_key=_env("GNEWS_API_KEY", "your-gnews-api-key"),
            endpoint=_env("GNEWS_ENDPOINT", "https://gnews.io/api/v4/search"),
        ),
        timescale=TimescaleSettings(
            dsn=_env("TIMESCALE_DSN", "postgresql://user:password@localhost:5432/kyzlo"),
        ),
        risk=RiskSettings(
            daily_loss_limit=float(os.getenv("RISK_DAILY_LOSS_LIMIT", "1000.0")),
            max_notional=float(os.getenv("RISK_MAX_NOTIONAL", "100000.0")),
            max_position_symbol=_env("RISK_MAX_POSITION_SYMBOL", "AAPL"),
            max_position_quantity=int(os.getenv("RISK_MAX_POSITION_QUANTITY", "100")),
        ),
    )


def build_components() -> dict:
    """Construct all platform components for wiring in main.py."""

    settings = load_settings()
    bus = EventBus()
    engine = PartitionedEngine()
    market_data: MarketDataPort = PolygonStream(
        api_key=settings.polygon.api_key, websocket_url=settings.polygon.websocket_url
    )
    broker: BrokerPort = AlpacaBroker(
        api_key=settings.alpaca.api_key,
        api_secret=settings.alpaca.api_secret,
        base_url=settings.alpaca.base_url,
    )
    persistence: PersistencePort = TimescaleRepository(dsn=settings.timescale.dsn)
    fundamentals: FundamentalsPort = AlphaVantageClient(
        api_key=settings.alpha_vantage.api_key, base_url=settings.alpha_vantage.base_url
    )
    news: NewsPort = GNewsClient(
        api_key=settings.gnews.api_key, endpoint=settings.gnews.endpoint
    )
    kill_switch = KillSwitch(daily_loss_limit=settings.risk.daily_loss_limit)
    risk_rules = [
        MaxPositionRule(
            symbol=settings.risk.max_position_symbol,
            max_quantity=settings.risk.max_position_quantity,
        ),
        MaxNotionalRule(max_notional=settings.risk.max_notional),
    ]
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
