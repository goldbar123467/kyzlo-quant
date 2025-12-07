# KYZLO Quant Platform

A production-grade algorithmic trading system built on **Hexagonal Architecture** (Ports & Adapters) with event-driven processing. Designed for low-latency execution, fault tolerance, and clean separation of concerns.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS                            │
│    Polygon WebSocket · Alpaca REST · Alpha Vantage · GNews     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ADAPTERS          Concrete implementations of ports            │
│  ─────────────────────────────────────────────────────────────  │
│  PolygonStream   → MarketDataPort                               │
│  AlpacaBroker    → BrokerPort                                   │
│  TimescaleRepo   → PersistencePort                              │
│  AlphaVantage    → FundamentalsPort                             │
│  GNewsClient     → NewsPort                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION       Orchestration & Event Routing                │
│  ─────────────────────────────────────────────────────────────  │
│  EventBus · PartitionedEngine · OrderStateMachine               │
│  PositionTracker · RiskService · ExecutionService               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  DOMAIN            Pure Business Logic (No I/O)                 │
│  ─────────────────────────────────────────────────────────────  │
│  Strategies · Risk Rules · Kill Switch · Models · Events        │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency Rule:** Inner layers never import outer layers. Domain knows nothing about Alpaca, Polygon, or TimescaleDB.

---

## Key Design Decisions

### 1. Hexagonal Architecture
The system separates business logic from infrastructure through explicit **ports** (interfaces) and **adapters** (implementations). This enables:
- Swapping brokers (Alpaca → Interactive Brokers) without touching strategy code
- Unit testing domain logic with zero external dependencies
- Clear boundaries for team ownership and code changes

### 2. Event-Driven Processing
All communication flows through an **EventBus** with typed events:
```
TickEvent → SignalEvent → OrderEvent → FillEvent
```
This decouples producers from consumers and enables replay/debugging of the full event stream.

### 3. Partitioned Engine
Events are routed to **per-symbol workers** ensuring FIFO ordering within each symbol. AAPL events never interleave with MSFT, preventing race conditions in position tracking.

### 4. Ring Buffer Backpressure
During high-volume periods (market open, news events), the system maintains a **maxlen=1 buffer** per symbol—always trading on the latest tick, never on stale data.

### 5. Idempotency Keys
Signals generate deterministic UUIDs via `hash(symbol + strategy + timestamp)`. On crash recovery, the system regenerates identical UUIDs—brokers reject duplicates automatically.

---

## Data Flow: Tick to Trade

| Step | Location | Input → Output |
|------|----------|----------------|
| 1. Tick Arrives | `adapters/market_data/polygon.py` | WebSocket JSON → `Tick` in ring buffer |
| 2. Event Published | `application/bus.py` | `Tick` → `TickEvent` on bus |
| 3. Engine Routes | `application/engine.py` | `TickEvent` → correct `SymbolWorker` queue |
| 4. Strategy Thinks | `domain/strategy/golden_cross.py` | `DataFrame` → `Signal` (or None) |
| 5. Idempotency Key | `infrastructure/idempotency.py` | `Signal` → `Signal` + deterministic UUID |
| 6. Risk Check | `domain/risk/rules.py` | `Signal` + positions + P&L → `Order` (or rejection) |
| 7. Order Submitted | `adapters/broker/alpaca.py` | `Order` → HTTPS request with `client_order_id` |
| 8. Fill Received | `adapters/broker/alpaca.py` | WebSocket update → `FillEvent` |
| 9. Position Updated | `application/position_tracker.py` | `FillEvent` → in-memory position state |
| 10. Persisted | `adapters/persistence/timescale.py` | All events → bitemporal storage |

---

## Fault Tolerance

### Kill Switch
Automatic triggers halt all trading:
- Daily loss limit exceeded
- Broker connection lost >60 seconds
- Manual trigger via Discord (`!halt`)

### Circuit Breaker
Prevents cascading failures when external APIs degrade:
- After 5 consecutive failures, back off for 60 seconds
- Protects against hammering dead endpoints

### Bitemporal Persistence
TimescaleDB stores both **transaction time** (when we learned it) and **valid time** (when it happened). Enables accurate historical analysis and point-in-time debugging.

---

## Project Structure

```
kyzlo_quant/
├── config/                     # Configuration
│   ├── settings.toml           # System constants
│   └── secrets.yaml            # API keys (gitignored)
│
├── src/
│   ├── domain/                 # Pure business logic
│   │   ├── models.py           # Tick, Signal, Order, Position
│   │   ├── events.py           # Event types
│   │   ├── strategy/           # Alpha generation
│   │   └── risk/               # Risk rules, kill switch
│   │
│   ├── ports/                  # Abstract interfaces
│   │   ├── broker.py           # BrokerPort ABC
│   │   ├── market_data.py      # MarketDataPort ABC
│   │   ├── persistence.py      # PersistencePort ABC
│   │   ├── fundamentals.py     # FundamentalsPort ABC
│   │   └── news.py             # NewsPort ABC
│   │
│   ├── application/            # Orchestration
│   │   ├── bus.py              # EventBus (pub/sub)
│   │   ├── engine.py           # PartitionedEngine
│   │   ├── fsm.py              # OrderStateMachine
│   │   └── services.py         # Risk, Execution services
│   │
│   ├── adapters/               # Concrete implementations
│   │   ├── market_data/polygon.py
│   │   ├── broker/alpaca.py
│   │   ├── persistence/timescale.py
│   │   ├── fundamentals/alpha_vantage.py
│   │   └── news/gnews.py
│   │
│   └── infrastructure/         # Cross-cutting utilities
│       ├── resilience.py       # CircuitBreaker, retry logic
│       ├── idempotency.py      # UUID generation
│       └── clock.py            # Live/Backtest clock
│
├── tests/
│   ├── unit/                   # Domain layer tests
│   ├── integration/            # Adapter tests
│   └── e2e/                    # Full system tests
│
├── docker/
│   ├── timescale/init.sql      # Bitemporal schema
│   └── app.Dockerfile
│
└── main.py                     # Entry point
```

---

## Order State Machine

```
              ┌─────────┐
              │ PENDING │
              └────┬────┘
                   │ submit()
                   ▼
              ┌─────────────┐
        ┌─────│  SUBMITTED  │─────┐
        │     └──────┬──────┘     │
   reject()       fill()      timeout()
        │            │            │
        ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────────┐
  │ REJECTED │ │  FILLED  │ │CANCEL_PENDING│
  └──────────┘ └──────────┘ └──────┬───────┘
                                   │ confirmed()
                                   ▼
                             ┌───────────┐
                             │ CANCELLED │
                             └───────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Python 3.11+ (async/await) |
| Market Data | Polygon.io WebSocket |
| Fundamentals | Alpha Vantage API |
| News/Sentiment | GNews API |
| Broker | Alpaca Markets API |
| Database | TimescaleDB (bitemporal) |
| Container | Docker Compose |
| Monitoring | Discord bot integration |

---

## Interactive Architecture Diagram

The repository includes an interactive React component (`kyzlo_architecture.jsx`) that visualizes:
- Expandable folder structure with file-level documentation
- Step-by-step data flow animation
- Layer color coding (Domain, Ports, Application, Adapters, Infrastructure)

---

## License

MIT
