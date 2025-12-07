# KYZLO QUANT PLATFORM - Complete Architecture Reference

## 📁 COMPLETE FOLDER STRUCTURE

```
kyzlo_quant/
│
├── config/                          # ⚙️ CONFIGURATION
│   ├── settings.toml                # System constants: timeouts, SMA periods, risk limits
│   └── secrets.yaml                 # API keys (⚠️ GITIGNORE THIS!)
│
├── docker/                          # 🐳 INFRASTRUCTURE AS CODE
│   ├── timescale/                   # Database initialization scripts
│   │   └── init.sql                 # Bitemporal schema setup
│   └── app.Dockerfile               # Python runtime container
│
├── src/                             # 🔮 SOURCE CODE
│   │
│   ├── config.py                    # Config loading & validation
│   │
│   ├── domain/                      # 🧠 PURE LOGIC (No I/O, No Async)
│   │   ├── __init__.py
│   │   ├── models.py                # Tick, Signal, Order, Position, OrderState
│   │   ├── events.py                # TickEvent, SignalEvent, OrderEvent, FillEvent
│   │   │
│   │   ├── strategy/                # Alpha Generation
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # StrategyBase ABC
│   │   │   └── golden_cross.py      # Your first strategy
│   │   │
│   │   └── risk/                    # Risk Rules
│   │       ├── __init__.py
│   │       ├── rules.py             # Individual check functions
│   │       └── kill_switch.py       # Emergency halt logic
│   │
│   ├── ports/                       # 🔌 ABSTRACT INTERFACES
│   │   ├── __init__.py
│   │   ├── broker.py                # BrokerPort ABC
│   │   ├── market_data.py           # MarketDataPort ABC
│   │   └── persistence.py           # PersistencePort ABC
│   │
│   ├── application/                 # ⚡ ORCHESTRATION
│   │   ├── __init__.py
│   │   ├── bus.py                   # EventBus (pub/sub)
│   │   ├── engine.py                # PartitionedEngine (per-symbol workers)
│   │   ├── fsm.py                   # OrderStateMachine
│   │   ├── position_tracker.py      # In-memory position state
│   │   └── services.py              # RiskService, ExecutionService
│   │
│   ├── adapters/                    # 🔗 CONCRETE IMPLEMENTATIONS
│   │   ├── __init__.py
│   │   │
│   │   ├── market_data/
│   │   │   ├── __init__.py
│   │   │   └── polygon.py           # PolygonStream(MarketDataPort)
│   │   │
│   │   ├── broker/
│   │   │   ├── __init__.py
│   │   │   └── alpaca.py            # AlpacaBroker(BrokerPort)
│   │   │
│   │   └── persistence/
│   │       ├── __init__.py
│   │       └── timescale.py         # TimescaleRepo(PersistencePort)
│   │
│   └── infrastructure/              # 🔧 CROSS-CUTTING UTILITIES
│       ├── __init__.py
│       ├── logging.py               # Structured JSON logging
│       ├── idempotency.py           # UUID generation for signals
│       ├── clock.py                 # LiveClock / BacktestClock
│       └── resilience.py            # CircuitBreaker, retry logic
│
├── tests/                           # 🧪 TEST SUITE
│   ├── unit/                        # Test domain/ in isolation
│   │   ├── test_golden_cross.py
│   │   ├── test_risk_rules.py
│   │   └── test_models.py
│   ├── integration/                 # Test adapters/ against real services
│   │   ├── test_alpaca.py
│   │   └── test_polygon.py
│   └── e2e/                         # Full system tests
│       └── test_tick_to_fill.py
│
├── scripts/                         # 🛠️ UTILITY SCRIPTS
│   ├── backfill_data.py             # Historical data loading
│   ├── migrate_db.py                # Database migrations
│   └── paper_trade.py               # Quick paper trading launcher
│
├── main.py                          # 🚀 ENTRY POINT
└── README.md
```

---

## ⚡ DATA FLOW: TICK TO TRADE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL WORLD                                     │
│                    (Polygon WebSocket, Alpaca REST API)                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: TICK ARRIVES                                                        │
│  ════════════════════                                                        │
│  📍 Location: adapters/market_data/polygon.py                               │
│  📥 Input: JSON from WebSocket                                               │
│  📤 Output: Tick object in ring buffer (deque maxlen=1)                     │
│  💡 Key: Only latest tick kept - prevents stale data trading                │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: EVENT PUBLISHED                                                     │
│  ══════════════════════                                                      │
│  📍 Location: application/bus.py                                            │
│  📥 Input: Tick                                                              │
│  📤 Output: TickEvent on the bus                                            │
│  💡 Key: Decouples producer (Polygon) from consumers (Strategy, DB)         │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: ENGINE ROUTES                                                       │
│  ════════════════════                                                        │
│  📍 Location: application/engine.py                                         │
│  📥 Input: TickEvent                                                        │
│  📤 Output: Event queued to correct SymbolWorker                            │
│  💡 Key: FIFO per symbol - AAPL events never interleave                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: STRATEGY THINKS                                                     │
│  ══════════════════════                                                      │
│  📍 Location: domain/strategy/golden_cross.py                               │
│  📥 Input: DataFrame of recent prices                                        │
│  📤 Output: Signal (BUY/SELL) or None                                       │
│  💡 Key: PURE LOGIC - no I/O, no async, just math                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  sma_fast = df['close'].rolling(20).mean()            │                 │
│  │  sma_slow = df['close'].rolling(50).mean()            │                 │
│  │  if sma_fast crosses above sma_slow → BUY             │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: IDEMPOTENCY KEY GENERATED                                           │
│  ════════════════════════════════                                            │
│  📍 Location: infrastructure/idempotency.py                                 │
│  📥 Input: Signal                                                            │
│  📤 Output: Signal + deterministic UUID                                      │
│  💡 Key: Hash(symbol + strategy + timestamp) → same signal = same UUID      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  If system crashes and restarts, it regenerates the   │                 │
│  │  same UUID. Broker sees duplicate → ignores it.       │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: RISK CHECK                                                          │
│  ════════════════                                                            │
│  📍 Location: application/services.py → domain/risk/rules.py               │
│  📥 Input: Signal + current positions + P&L                                 │
│  📤 Output: Order (approved) or None (rejected)                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  CHECKLIST:                                            │                 │
│  │  ✓ Is market open?                                     │                 │
│  │  ✓ Do we have buying power?                            │                 │
│  │  ✓ Is position under limit?                            │                 │
│  │  ✓ Is daily loss under limit?                          │                 │
│  │  ✓ Is kill switch OFF?                                 │                 │
│  │  ✓ Is idempotency key fresh (not duplicate)?           │                 │
│  │                                                         │                 │
│  │  ALL PASS → mint Order                                 │                 │
│  │  ANY FAIL → reject, log reason                         │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: ORDER SUBMITTED                                                     │
│  ══════════════════════                                                      │
│  📍 Location: adapters/broker/alpaca.py                                     │
│  📥 Input: Order                                                             │
│  📤 Output: HTTPS request to Alpaca API                                     │
│  💡 Key: client_order_id = idempotency UUID                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  MarketOrderRequest(                                   │                 │
│  │      symbol="AAPL",                                    │                 │
│  │      qty=10,                                           │                 │
│  │      side=OrderSide.BUY,                               │                 │
│  │      client_order_id="a1b2c3-uuid"  ← CRITICAL        │                 │
│  │  )                                                     │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: FILL RECEIVED                                                       │
│  ═══════════════════                                                         │
│  📍 Location: application/position_tracker.py                               │
│  📥 Input: FillEvent from broker                                            │
│  📤 Output: Updated Position in memory                                       │
│  💡 Key: This is HOT PATH - must be fast, in-memory only                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  positions["AAPL"] = Position(                         │                 │
│  │      symbol="AAPL",                                    │                 │
│  │      quantity=10,                                      │                 │
│  │      avg_entry_price=185.50,                           │                 │
│  │      opened_at=datetime.now()                          │                 │
│  │  )                                                     │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 9: PERSISTED (ASYNC - COLD PATH)                                       │
│  ═══════════════════════════════════                                         │
│  📍 Location: adapters/persistence/timescale.py                             │
│  📥 Input: All events (Tick, Order, Fill)                                   │
│  📤 Output: SQL INSERT (async, non-blocking)                                │
│  💡 Key: knowledge_time = when we learned it, not when it happened          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │  INSERT INTO orders (                                  │                 │
│  │      order_id, symbol, side, quantity,                 │                 │
│  │      event_time,      -- when order was created        │                 │
│  │      knowledge_time   -- when DB learned about it      │                 │
│  │  )                                                     │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ HEXAGONAL ARCHITECTURE LAYERS

```
                    ┌─────────────────────────────────────┐
                    │         EXTERNAL WORLD              │
                    │   (Alpaca, Polygon, TimescaleDB)    │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │           ADAPTERS                  │
                    │  (Translate external ↔ internal)   │
                    │   alpaca.py, polygon.py, timescale │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │            PORTS                    │
                    │    (Abstract interfaces - ABCs)     │
                    │  BrokerPort, MarketDataPort, etc.   │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │          APPLICATION                │
                    │      (Orchestration layer)          │
                    │   EventBus, Engine, Services        │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │            DOMAIN                   │
                    │    (Pure business logic)            │
                    │  Strategy, Risk, Models, Events     │
                    └─────────────────────────────────────┘
                                   
                    ┌─────────────────────────────────────┐
                    │         INFRASTRUCTURE              │
                    │   (Cross-cutting: logging, clock)   │
                    └─────────────────────────────────────┘
```

### THE DEPENDENCY RULE

```
🔒 CRITICAL: Dependencies point INWARD only.

   ADAPTERS → PORTS → APPLICATION → DOMAIN
       │         │          │          │
       │         │          │          └── Knows NOTHING about outside world
       │         │          └── Knows about Domain, not Adapters
       │         └── Defines interfaces, no implementations
       └── Implements Ports, knows about external APIs

   ✅ domain/golden_cross.py imports domain/models.py
   ✅ application/services.py imports ports/broker.py
   ✅ adapters/alpaca.py imports ports/broker.py
   
   ❌ domain/golden_cross.py imports adapters/alpaca.py  ← NEVER
   ❌ domain/risk/rules.py imports application/bus.py    ← NEVER
```

---

## 🔥 HOT PATH vs ❄️ COLD PATH

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔥 HOT PATH (Latency-Critical)                                             │
│  ════════════════════════════════                                            │
│                                                                              │
│  Tick → Strategy → Risk → Order → Broker                                    │
│                                                                              │
│  Rules:                                                                      │
│  • No database reads/writes                                                  │
│  • No blocking I/O                                                           │
│  • Ring buffer for latest price only                                         │
│  • In-memory position tracking                                               │
│  • Target: < 10ms end-to-end                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ❄️ COLD PATH (Async, Non-Blocking)                                         │
│  ══════════════════════════════════                                          │
│                                                                              │
│  All Events → Persistence Queue → TimescaleDB                               │
│                                                                              │
│  Rules:                                                                      │
│  • Fire and forget (async)                                                   │
│  • Batch writes where possible                                               │
│  • Never blocks hot path                                                     │
│  • Used for audit, analysis, debugging                                       │
│  • Target: < 1 second (doesn't affect trading)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ SAFETY MECHANISMS

### 1. Idempotency (Duplicate Prevention)

```python
# infrastructure/idempotency.py

def generate_key(signal: Signal) -> str:
    """Same signal always generates same UUID"""
    payload = f"{signal.symbol}:{signal.strategy_id}:{signal.generated_at.isoformat()}"
    return str(uuid.uuid5(NAMESPACE, payload))

# If system crashes at 9:31:15 and restarts at 9:31:20:
# - Regenerates same signals for 9:30:00 - 9:31:15
# - Same UUIDs generated
# - Broker sees duplicate client_order_id → ignores
```

### 2. Kill Switch (Emergency Halt)

```python
# domain/risk/kill_switch.py

class KillSwitch:
    def check(self, context: TradingContext) -> bool:
        """Returns True if trading should HALT"""
        
        # Auto-triggers (no human needed)
        if context.daily_pnl < -context.config.max_daily_loss:
            self.trigger("Daily loss limit exceeded")
            return True
        
        if context.broker_disconnected_seconds > 60:
            self.trigger("Broker connection lost")
            return True
        
        # Manual trigger (from Discord bot: !halt)
        if self.manual_halt:
            return True
        
        return False
```

### 3. Circuit Breaker (API Protection)

```python
# infrastructure/resilience.py

class CircuitBreaker:
    """Prevents cascading failures"""
    
    # After 5 failures in a row, stop trying for 60 seconds
    # Prevents hammering a dead API
    
    async def call(self, func, *args):
        if self.is_open:
            raise CircuitOpenError("Backing off - too many failures")
        try:
            return await func(*args)
        except Exception:
            self._record_failure()
            raise
```

### 4. Ring Buffer (Backpressure)

```python
# adapters/market_data/polygon.py

self.buffers[symbol] = deque(maxlen=1)  # ONLY latest tick

# During market crash: 10,000 ticks/sec arrive
# Strategy processes: 100 ticks/sec
# Without ring buffer: queue grows, trading on 5-min-old prices
# With ring buffer: always trade on LATEST price, skip the rest
```

---

## 📊 ORDER STATE MACHINE

```
                    ┌─────────┐
                    │ PENDING │
                    └────┬────┘
                         │ submit()
                         ▼
                    ┌─────────────┐
              ┌─────│  SUBMITTED  │─────┐
              │     └──────┬──────┘     │
              │            │            │
         reject()      fill()      timeout()
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ REJECTED │ │  FILLED  │ │CANCEL_PENDING│
        └──────────┘ └──────────┘ └──────┬───────┘
                                         │
                                    confirmed()
                                         │
                                         ▼
                                   ┌───────────┐
                                   │ CANCELLED │
                                   └───────────┘
```

---

## 🚀 BUILD SEQUENCE

### Week 1: Domain Layer
```bash
# What to build:
src/domain/models.py      # All dataclasses
src/domain/events.py      # All event types  
src/domain/strategy/golden_cross.py
tests/unit/test_golden_cross.py

# Validation:
pytest tests/unit/ -v
# All tests pass with NO external dependencies
```

### Week 2: Application Layer
```bash
# What to build:
src/application/bus.py           # Simple asyncio.Queue pub/sub
src/application/engine.py        # Single worker first (no partitioning)
src/application/position_tracker.py

# Validation:
# Can publish TickEvent, receive SignalEvent
```

### Week 3: Adapters
```bash
# What to build:
src/ports/broker.py              # BrokerPort ABC
src/adapters/broker/alpaca.py    # AlpacaBroker(BrokerPort)
src/adapters/market_data/polygon.py

# Validation:
# Paper trade test - real WebSocket, real (paper) orders
```

### Week 4: Infrastructure + Integration
```bash
# What to build:
src/infrastructure/resilience.py
src/infrastructure/idempotency.py
main.py                          # Full wiring

# Validation:
# Run for 5 trading days on paper
# Review logs, fix what breaks
```

### Week 5: Live (Small Size)
```bash
# What to do:
# - Switch to live credentials
# - Max position: $500
# - Monitor via Discord
# - Review every evening
```

---

## 📱 DISCORD BOT COMMANDS (Future)

```
!status        → Show system state, positions, P&L
!halt          → Trigger kill switch, flatten all
!resume        → Disable kill switch
!flatten       → Close all positions, keep running
!positions     → List current holdings
!orders        → List open orders
!pnl           → Today's P&L breakdown
```

---

## 🎯 SUCCESS METRICS

```
Before going live, validate:

✓ Unit tests pass (domain layer)
✓ Integration tests pass (adapters)
✓ Paper traded for 5+ days without crash
✓ Kill switch tested (manually triggered, system halted)
✓ Idempotency tested (restarted system, no duplicate orders)
✓ Discord alerts working (every trade, every error)
✓ Can flatten from phone in < 30 seconds
```

---

*Generated for Clark's Kyzlo Quant Platform*
*Architecture: Hexagonal / Ports & Adapters*
*Pattern: Event-Driven with Partitioned Processing*
