import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

import tomllib

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

def load_settings() -> Settings:
    """Load configuration from environment with optional config file defaults."""

    settings_path = Path("config/settings.toml")
    file_settings = _load_file_settings(settings_path)

    return Settings(
        alpaca=AlpacaSettings(
            api_key=_config_value("ALPACA_API_KEY", file_settings, "alpaca", "api_key", "your-alpaca-api-key"),
            api_secret=_config_value(
                "ALPACA_API_SECRET", file_settings, "alpaca", "api_secret", "your-alpaca-api-secret"
            ),
            base_url=_config_value(
                "ALPACA_BASE_URL", file_settings, "alpaca", "base_url", "https://paper-api.alpaca.markets"
            ),
        ),
        polygon=PolygonSettings(
            api_key=_config_value("POLYGON_API_KEY", file_settings, "polygon", "api_key", "your-polygon-api-key"),
            websocket_url=_config_value(
                "POLYGON_WEBSOCKET_URL", file_settings, "polygon", "websocket_url", "wss://socket.polygon.io/stocks"
            ),
        ),
        alpha_vantage=AlphaVantageSettings(
            api_key=_config_value(
                "ALPHA_VANTAGE_API_KEY", file_settings, "alpha_vantage", "api_key", "your-alpha-vantage-key"
            ),
            base_url=_config_value(
                "ALPHA_VANTAGE_BASE_URL",
                file_settings,
                "alpha_vantage",
                "base_url",
                "https://www.alphavantage.co",
            ),
        ),
        gnews=GNewsSettings(
            api_key=_config_value("GNEWS_API_KEY", file_settings, "gnews", "api_key", "your-gnews-api-key"),
            endpoint=_config_value(
                "GNEWS_ENDPOINT", file_settings, "gnews", "endpoint", "https://gnews.io/api/v4/search"
            ),
        ),
        timescale=TimescaleSettings(
            dsn=_config_value(
                "TIMESCALE_DSN", file_settings, "timescale", "dsn", "postgresql://user:password@localhost:5432/kyzlo"
            ),
        ),
        risk=RiskSettings(
            daily_loss_limit=float(
                _config_value("RISK_DAILY_LOSS_LIMIT", file_settings, "risk", "daily_loss_limit", "1000.0")
            ),
            max_notional=float(
                _config_value("RISK_MAX_NOTIONAL", file_settings, "risk", "max_notional", "100000.0")
            ),
            max_position_symbol=_config_value(
                "RISK_MAX_POSITION_SYMBOL", file_settings, "risk", "max_position_symbol", "AAPL"
            ),
            max_position_quantity=int(
                _config_value("RISK_MAX_POSITION_QUANTITY", file_settings, "risk", "max_position_quantity", "100")
            ),
        ),
    )


def _load_file_settings(settings_path: Path) -> Dict[str, Any]:
    if not settings_path.exists():
        return {}

    with settings_path.open("rb") as settings_file:
        return tomllib.load(settings_file)


def _config_value(
    env_key: str, settings: Dict[str, Any], section: str, key: str, default: str
) -> str:
    if env_key in os.environ:
        return os.environ[env_key]

    section_data = settings.get(section, {})
    return str(section_data.get(key, default))


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
