import React, { useState } from 'react';

const KyzloArchitecture = () => {
  const [activeView, setActiveView] = useState('structure');
  const [expandedFolders, setExpandedFolders] = useState({
    'kyzlo_quant': true,
    'src': true,
    'domain': false,
    'ports': false,
    'application': false,
    'adapters': false,
    'infrastructure': false,
    'config': false,
    'docker': false,
    'tests': false,
    'scripts': false
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const fileDescriptions = {
    // Config
    'settings.toml': {
      purpose: 'System configuration constants',
      contains: 'Timeouts, buffer sizes, SMA periods, risk limits',
      layer: 'config'
    },
    'secrets.yaml': {
      purpose: 'API credentials (GITIGNORE THIS)',
      contains: 'Alpaca keys, Polygon keys, DB passwords',
      layer: 'config'
    },
    // Domain - Models & Events
    'models.py': {
      purpose: 'Core data structures - the "atoms" of your system',
      contains: 'Tick, Signal, Order, Position, OrderState enum',
      layer: 'domain',
      code: `@dataclass
class Tick:
    symbol: str
    price: float
    volume: int
    timestamp: datetime

@dataclass
class Signal:
    symbol: str
    direction: Literal["BUY", "SELL"]
    strength: float
    strategy_id: str
    generated_at: datetime

@dataclass  
class Order:
    id: str  # UUID from idempotency
    symbol: str
    side: Literal["BUY", "SELL"]
    quantity: int
    order_type: Literal["MARKET", "LIMIT"]
    limit_price: Optional[float]
    state: OrderState

class OrderState(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"`
    },
    'events.py': {
      purpose: 'Event types for the message bus',
      contains: 'TickEvent, SignalEvent, OrderEvent, FillEvent',
      layer: 'domain',
      code: `@dataclass
class TickEvent:
    tick: Tick
    received_at: datetime

@dataclass
class SignalEvent:
    signal: Signal
    idempotency_key: str

@dataclass
class OrderEvent:
    order: Order
    risk_approved: bool

@dataclass
class FillEvent:
    order_id: str
    filled_qty: int
    avg_price: float
    filled_at: datetime`
    },
    // Domain - Strategy
    'base.py': {
      purpose: 'Abstract base class for all strategies',
      contains: 'StrategyBase ABC with on_tick() method',
      layer: 'domain',
      code: `class StrategyBase(ABC):
    def __init__(self, config: StrategyConfig):
        self.config = config
    
    @abstractmethod
    def on_tick(self, symbol: str, df: pd.DataFrame) -> Optional[Signal]:
        """Pure logic: DataFrame in, Signal out (or None)"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass`
    },
    'golden_cross.py': {
      purpose: 'Your first strategy - SMA crossover',
      contains: 'GoldenCross class implementing StrategyBase',
      layer: 'domain',
      code: `class GoldenCross(StrategyBase):
    @property
    def name(self) -> str:
        return "golden_cross"
    
    def on_tick(self, symbol: str, df: pd.DataFrame) -> Optional[Signal]:
        if len(df) < self.config.sma_slow:
            return None
        
        sma_fast = df['close'].rolling(self.config.sma_fast).mean()
        sma_slow = df['close'].rolling(self.config.sma_slow).mean()
        
        # Cross detection
        prev_fast, curr_fast = sma_fast.iloc[-2], sma_fast.iloc[-1]
        prev_slow, curr_slow = sma_slow.iloc[-2], sma_slow.iloc[-1]
        
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            return Signal(
                symbol=symbol,
                direction="BUY",
                strength=1.0,
                strategy_id=self.name,
                generated_at=self.clock.now()
            )
        # ... SELL logic
        return None`
    },
    // Domain - Risk
    'rules.py': {
      purpose: 'Individual risk check functions',
      contains: 'Pure functions that return bool (pass/fail)',
      layer: 'domain',
      code: `def check_position_limit(
    order: Order, 
    positions: dict[str, Position],
    config: RiskConfig
) -> tuple[bool, str]:
    """Returns (passed, reason)"""
    current = positions.get(order.symbol)
    if current and abs(current.quantity) >= config.max_position_size:
        return False, f"Position limit reached: {current.quantity}"
    return True, ""

def check_daily_loss(
    pnl_today: float,
    config: RiskConfig
) -> tuple[bool, str]:
    if pnl_today < -config.max_daily_loss:
        return False, f"Daily loss limit hit: {pnl_today}"
    return True, ""`
    },
    'kill_switch.py': {
      purpose: 'Emergency halt logic',
      contains: 'KillSwitch class that can freeze all trading',
      layer: 'domain',
      code: `class KillSwitch:
    def __init__(self):
        self.triggered = False
        self.reason = ""
    
    def check(self, context: TradingContext) -> bool:
        """Returns True if trading should HALT"""
        if self.triggered:
            return True
        
        # Auto-triggers
        if context.daily_pnl < -context.config.max_daily_loss:
            self.trigger("Daily loss limit exceeded")
            return True
        
        if context.broker_disconnected_seconds > 60:
            self.trigger("Broker connection lost")
            return True
        
        return False
    
    def trigger(self, reason: str):
        self.triggered = True
        self.reason = reason
        # Emit alert`
    },
    // Ports
    'broker.py': {
      purpose: 'Abstract interface for any broker',
      contains: 'BrokerPort ABC - Alpaca implements this',
      layer: 'ports',
      code: `class BrokerPort(ABC):
    @abstractmethod
    async def submit_order(self, order: Order) -> OrderAck:
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        pass
    
    @abstractmethod
    async def get_positions(self) -> list[Position]:
        pass
    
    @abstractmethod
    async def get_account(self) -> Account:
        pass`
    },
    'market_data.py': {
      purpose: 'Abstract interface for market data feeds',
      contains: 'MarketDataPort ABC - Polygon implements this',
      layer: 'ports',
      code: `class MarketDataPort(ABC):
    @abstractmethod
    async def subscribe(self, symbols: list[str]) -> None:
        pass
    
    @abstractmethod
    async def stream(self) -> AsyncIterator[Tick]:
        """Yields ticks as they arrive"""
        pass
    
    @abstractmethod
    def get_latest(self, symbol: str) -> Optional[Tick]:
        """Hot path: latest tick from ring buffer"""
        pass`
    },
    'persistence.py': {
      purpose: 'Abstract interface for data storage',
      contains: 'PersistencePort ABC - TimescaleDB implements this',
      layer: 'ports',
      code: `class PersistencePort(ABC):
    @abstractmethod
    async def save_tick(self, tick: Tick, knowledge_time: datetime) -> None:
        pass
    
    @abstractmethod
    async def save_order(self, order: Order) -> None:
        pass
    
    @abstractmethod
    async def get_ohlcv(
        self, 
        symbol: str, 
        start: datetime, 
        end: datetime
    ) -> pd.DataFrame:
        pass`
    },
    // Application
    'bus.py': {
      purpose: 'The nervous system - routes all messages',
      contains: 'EventBus class with pub/sub pattern',
      layer: 'application',
      code: `class EventBus:
    def __init__(self):
        self._subscribers: dict[type, list[Callable]] = defaultdict(list)
        self._queue: asyncio.Queue = asyncio.Queue()
    
    def subscribe(self, event_type: type, handler: Callable):
        self._subscribers[event_type].append(handler)
    
    async def publish(self, event: Any):
        await self._queue.put(event)
    
    async def run(self):
        while True:
            event = await self._queue.get()
            handlers = self._subscribers[type(event)]
            for handler in handlers:
                await handler(event)`
    },
    'engine.py': {
      purpose: 'The partitioned processing loop',
      contains: 'PartitionedEngine with per-symbol workers',
      layer: 'application',
      code: `class PartitionedEngine:
    def __init__(self, symbols: list[str], ...):
        self.workers = {
            symbol: SymbolWorker(symbol, ...)
            for symbol in symbols
        }
    
    async def on_tick(self, event: TickEvent):
        symbol = event.tick.symbol
        worker = self.workers.get(symbol)
        if worker:
            await worker.queue.put(event)
    
    async def run(self):
        tasks = [
            worker.run() 
            for worker in self.workers.values()
        ]
        await asyncio.gather(*tasks)

class SymbolWorker:
    """Guarantees FIFO processing per symbol"""
    async def run(self):
        while True:
            event = await self.queue.get()
            await self.process(event)  # Never parallel`
    },
    'fsm.py': {
      purpose: 'Order state machine',
      contains: 'OrderStateMachine tracking order lifecycle',
      layer: 'application',
      code: `class OrderStateMachine:
    def __init__(self):
        self.orders: dict[str, Order] = {}
    
    def transition(self, order_id: str, new_state: OrderState) -> bool:
        order = self.orders.get(order_id)
        if not order:
            return False
        
        valid_transitions = {
            OrderState.PENDING: [OrderState.SUBMITTED, OrderState.REJECTED],
            OrderState.SUBMITTED: [OrderState.FILLED, OrderState.REJECTED, OrderState.CANCELLED],
            # ...
        }
        
        if new_state in valid_transitions.get(order.state, []):
            order.state = new_state
            return True
        return False`
    },
    'position_tracker.py': {
      purpose: 'Tracks current positions in memory',
      contains: 'PositionTracker updated on every fill',
      layer: 'application',
      code: `class PositionTracker:
    def __init__(self):
        self.positions: dict[str, Position] = {}
    
    async def on_fill(self, event: FillEvent):
        symbol = event.symbol
        pos = self.positions.get(symbol)
        
        if pos is None:
            self.positions[symbol] = Position(
                symbol=symbol,
                quantity=event.filled_qty,
                avg_entry_price=event.avg_price,
                opened_at=event.filled_at
            )
        else:
            # Update average price and quantity
            pos.update(event.filled_qty, event.avg_price)
    
    def get(self, symbol: str) -> Optional[Position]:
        return self.positions.get(symbol)`
    },
    'services.py': {
      purpose: 'Glue code connecting domain to adapters',
      contains: 'RiskService, ExecutionService',
      layer: 'application',
      code: `class RiskService:
    def __init__(self, rules: RiskRules, positions: PositionTracker, ...):
        self.rules = rules
        self.positions = positions
    
    async def evaluate(self, signal: Signal) -> Optional[Order]:
        # Run all risk checks
        checks = [
            self.rules.check_position_limit(signal, self.positions),
            self.rules.check_daily_loss(self.pnl_today),
            self.rules.check_market_hours(self.clock.now()),
        ]
        
        for passed, reason in checks:
            if not passed:
                self.logger.warn(f"Risk blocked: {reason}")
                return None
        
        return self._signal_to_order(signal)`
    },
    // Adapters - Market Data
    'polygon.py': {
      purpose: 'Polygon.io WebSocket implementation',
      contains: 'PolygonStream implementing MarketDataPort',
      layer: 'adapters',
      code: `class PolygonStream(MarketDataPort):
    def __init__(self, config: PolygonConfig):
        self.config = config
        self.buffers: dict[str, deque] = {}  # Ring buffers
    
    async def stream(self) -> AsyncIterator[Tick]:
        async with websockets.connect(self.config.ws_url) as ws:
            await self._authenticate(ws)
            await self._subscribe(ws, self.config.symbols)
            
            async for msg in ws:
                tick = self._parse(msg)
                # Ring buffer: only keep latest
                self.buffers[tick.symbol] = deque([tick], maxlen=1)
                yield tick
    
    def get_latest(self, symbol: str) -> Optional[Tick]:
        buf = self.buffers.get(symbol)
        return buf[0] if buf else None`
    },
    // Adapters - Broker
    'alpaca.py': {
      purpose: 'Alpaca API implementation',
      contains: 'AlpacaBroker implementing BrokerPort',
      layer: 'adapters',
      code: `class AlpacaBroker(BrokerPort):
    def __init__(self, config: AlpacaConfig, idempotency: IdempotencyService):
        self.client = TradingClient(config.api_key, config.secret_key)
        self.idempotency = idempotency
    
    async def submit_order(self, order: Order) -> OrderAck:
        request = MarketOrderRequest(
            symbol=order.symbol,
            qty=order.quantity,
            side=OrderSide.BUY if order.side == "BUY" else OrderSide.SELL,
            client_order_id=order.id  # IDEMPOTENCY KEY
        )
        
        try:
            result = self.client.submit_order(request)
            return OrderAck(success=True, broker_id=result.id)
        except APIError as e:
            return OrderAck(success=False, error=str(e))`
    },
    // Adapters - Persistence
    'timescale.py': {
      purpose: 'TimescaleDB implementation',
      contains: 'TimescaleRepo implementing PersistencePort',
      layer: 'adapters',
      code: `class TimescaleRepo(PersistencePort):
    async def save_tick(self, tick: Tick, knowledge_time: datetime):
        """Bitemporal: event_time vs knowledge_time"""
        await self.pool.execute("""
            INSERT INTO ticks (
                symbol, price, volume, 
                event_time, knowledge_time
            ) VALUES ($1, $2, $3, $4, $5)
        """, tick.symbol, tick.price, tick.volume,
            tick.timestamp, knowledge_time)
    
    async def get_ohlcv(self, symbol: str, start: datetime, end: datetime):
        rows = await self.pool.fetch("""
            SELECT time_bucket('1 minute', event_time) as bucket,
                   first(price, event_time) as open,
                   max(price) as high,
                   min(price) as low,
                   last(price, event_time) as close,
                   sum(volume) as volume
            FROM ticks
            WHERE symbol = $1 AND event_time BETWEEN $2 AND $3
            GROUP BY bucket ORDER BY bucket
        """, symbol, start, end)
        return pd.DataFrame(rows)`
    },
    // Infrastructure
    'logging.py': {
      purpose: 'Structured JSON logging',
      contains: 'StructuredLogger for observability',
      layer: 'infrastructure',
      code: `class StructuredLogger:
    def __init__(self, config: LogConfig):
        self.logger = structlog.get_logger()
    
    def trade(self, order: Order, result: OrderAck):
        self.logger.info(
            "trade_executed",
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            success=result.success,
            broker_id=result.broker_id
        )`
    },
    'idempotency.py': {
      purpose: 'Generates deterministic UUIDs for signals',
      contains: 'IdempotencyService preventing duplicate orders',
      layer: 'infrastructure',
      code: `class IdempotencyService:
    NAMESPACE = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
    
    def __init__(self):
        self.seen: set[str] = set()
    
    def generate_key(self, signal: Signal) -> str:
        """Deterministic: same signal = same UUID"""
        payload = f"{signal.symbol}:{signal.strategy_id}:{signal.generated_at.isoformat()}"
        return str(uuid.uuid5(self.NAMESPACE, payload))
    
    def is_duplicate(self, key: str) -> bool:
        if key in self.seen:
            return True
        self.seen.add(key)
        return False`
    },
    'clock.py': {
      purpose: 'Unified time source for live vs backtest',
      contains: 'Clock interface with Live and Backtest implementations',
      layer: 'infrastructure',
      code: `class Clock(ABC):
    @abstractmethod
    def now(self) -> datetime:
        pass

class LiveClock(Clock):
    def now(self) -> datetime:
        return datetime.now(timezone.utc)

class BacktestClock(Clock):
    def __init__(self, start: datetime):
        self._current = start
    
    def now(self) -> datetime:
        return self._current
    
    def advance(self, delta: timedelta):
        self._current += delta`
    },
    'resilience.py': {
      purpose: 'Retry logic and circuit breakers',
      contains: 'CircuitBreaker, retry decorators',
      layer: 'infrastructure',
      code: `class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60):
        self.failures = 0
        self.threshold = failure_threshold
        self.timeout = recovery_timeout
        self.last_failure: Optional[datetime] = None
    
    @property
    def is_open(self) -> bool:
        if self.failures < self.threshold:
            return False
        if (datetime.now() - self.last_failure).seconds > self.timeout:
            self.failures = 0  # Reset after timeout
            return False
        return True
    
    async def call(self, func, *args, **kwargs):
        if self.is_open:
            raise CircuitOpenError("Circuit breaker is open")
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            self.failures += 1
            self.last_failure = datetime.now()
            raise`
    },
    // Main
    'main.py': {
      purpose: 'Entry point - wires everything together',
      contains: 'Dependency injection and startup sequence',
      layer: 'main',
      code: `async def main():
    # 1. Load Configuration
    config = AppConfig.from_toml("config/settings.toml")
    
    # 2. Build Infrastructure
    clock = LiveClock()
    logger = StructuredLogger(config.logging)
    idempotency = IdempotencyService()
    
    # 3. Build Adapters (implementing Ports)
    broker = AlpacaBroker(config.broker, idempotency)
    market_data = PolygonStream(config.market_data)
    persistence = TimescaleRepo(config.database)
    
    # 4. Build Domain (pure logic)
    strategy = GoldenCross(config.strategy, clock)
    risk_rules = RiskRules(config.risk)
    kill_switch = KillSwitch()
    
    # 5. Build Application (orchestration)
    bus = EventBus()
    positions = PositionTracker()
    fsm = OrderStateMachine()
    risk_service = RiskService(risk_rules, positions, kill_switch)
    
    engine = PartitionedEngine(
        symbols=config.symbols,
        bus=bus,
        strategy=strategy,
        risk=risk_service,
        broker=broker,
        positions=positions,
        clock=clock
    )
    
    # 6. Wire Event Subscriptions
    bus.subscribe(TickEvent, engine.on_tick)
    bus.subscribe(SignalEvent, risk_service.evaluate)
    bus.subscribe(OrderEvent, broker.submit_order)
    bus.subscribe(FillEvent, positions.on_fill)
    bus.subscribe(FillEvent, persistence.save_fill)
    
    # 7. Start the System
    logger.info("system_starting", symbols=config.symbols)
    
    await asyncio.gather(
        market_data.stream_to_bus(bus),
        engine.run(),
        persistence.flush_loop(),
    )

if __name__ == "__main__":
    asyncio.run(main())`
    }
  };

  const flowSteps = [
    {
      id: 1,
      title: 'TICK ARRIVES',
      location: 'adapters/market_data/polygon.py',
      description: 'WebSocket receives JSON from Polygon. Ring buffer stores only the latest tick per symbol.',
      color: '#3b82f6',
      dataFlow: 'JSON → Tick object'
    },
    {
      id: 2,
      title: 'EVENT PUBLISHED',
      location: 'application/bus.py',
      description: 'Polygon adapter publishes TickEvent to the EventBus. Bus routes to all subscribers.',
      color: '#8b5cf6',
      dataFlow: 'Tick → TickEvent'
    },
    {
      id: 3,
      title: 'ENGINE ROUTES',
      location: 'application/engine.py',
      description: 'PartitionedEngine receives event, routes to correct SymbolWorker. FIFO guaranteed per symbol.',
      color: '#6366f1',
      dataFlow: 'TickEvent → Worker Queue'
    },
    {
      id: 4,
      title: 'STRATEGY THINKS',
      location: 'domain/strategy/golden_cross.py',
      description: 'Pure logic: receives DataFrame of recent prices, calculates SMAs, detects crossover.',
      color: '#10b981',
      dataFlow: 'DataFrame → Signal (or None)'
    },
    {
      id: 5,
      title: 'IDEMPOTENCY KEY',
      location: 'infrastructure/idempotency.py',
      description: 'Signal gets fingerprinted with deterministic UUID. Duplicates are detected and killed.',
      color: '#f59e0b',
      dataFlow: 'Signal → Signal + UUID'
    },
    {
      id: 6,
      title: 'RISK CHECK',
      location: 'application/services.py',
      description: 'RiskService runs all checks: position limits, daily loss, market hours, kill switch.',
      color: '#ef4444',
      dataFlow: 'Signal → Order (or rejected)'
    },
    {
      id: 7,
      title: 'ORDER SUBMITTED',
      location: 'adapters/broker/alpaca.py',
      description: 'AlpacaBroker translates Order to REST API call. client_order_id = idempotency UUID.',
      color: '#ec4899',
      dataFlow: 'Order → HTTPS → Alpaca'
    },
    {
      id: 8,
      title: 'FILL RECEIVED',
      location: 'application/position_tracker.py',
      description: 'Broker confirms fill. PositionTracker updates in-memory state. P&L recalculated.',
      color: '#14b8a6',
      dataFlow: 'FillEvent → Position update'
    },
    {
      id: 9,
      title: 'PERSISTED',
      location: 'adapters/persistence/timescale.py',
      description: 'Async write to TimescaleDB with knowledge_time. Cold path - never blocks hot path.',
      color: '#64748b',
      dataFlow: 'Events → SQL (async)'
    }
  ];

  const layerColors = {
    config: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    domain: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
    ports: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
    application: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
    adapters: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    infrastructure: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
    main: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' }
  };

  const FolderIcon = ({ isOpen }) => (
    <span style={{ marginRight: '6px', fontSize: '14px' }}>
      {isOpen ? '📂' : '📁'}
    </span>
  );

  const FileIcon = ({ type }) => {
    const icons = {
      py: '🐍',
      toml: '⚙️',
      yaml: '🔐',
      md: '📝',
      dockerfile: '🐳'
    };
    return <span style={{ marginRight: '6px', fontSize: '12px' }}>{icons[type] || '📄'}</span>;
  };

  const getFileType = (filename) => {
    if (filename.includes('Dockerfile')) return 'dockerfile';
    const ext = filename.split('.').pop();
    return ext;
  };

  const FolderStructure = () => (
    <div style={{ 
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: '13px',
      lineHeight: '1.6'
    }}>
      {/* Root */}
      <div 
        onClick={() => toggleFolder('kyzlo_quant')}
        style={{ cursor: 'pointer', padding: '4px 0', fontWeight: 'bold' }}
      >
        <FolderIcon isOpen={expandedFolders['kyzlo_quant']} />
        kyzlo_quant/
      </div>
      
      {expandedFolders['kyzlo_quant'] && (
        <div style={{ marginLeft: '20px' }}>
          {/* Config */}
          <div onClick={() => toggleFolder('config')} style={{ cursor: 'pointer', padding: '3px 0' }}>
            <FolderIcon isOpen={expandedFolders['config']} />
            <span style={{ color: layerColors.config.text }}>config/</span>
          </div>
          {expandedFolders['config'] && (
            <div style={{ marginLeft: '20px' }}>
              <div onClick={() => setSelectedFile('settings.toml')} 
                   style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'settings.toml' ? '#e0f2fe' : 'transparent' }}>
                <FileIcon type="toml" />settings.toml
              </div>
              <div onClick={() => setSelectedFile('secrets.yaml')}
                   style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'secrets.yaml' ? '#e0f2fe' : 'transparent' }}>
                <FileIcon type="yaml" />secrets.yaml <span style={{ color: '#ef4444', fontSize: '10px' }}>⚠️ GITIGNORE</span>
              </div>
            </div>
          )}

          {/* Docker */}
          <div onClick={() => toggleFolder('docker')} style={{ cursor: 'pointer', padding: '3px 0' }}>
            <FolderIcon isOpen={expandedFolders['docker']} />
            docker/
          </div>
          {expandedFolders['docker'] && (
            <div style={{ marginLeft: '20px' }}>
              <div style={{ padding: '2px 0' }}><FolderIcon isOpen={false} />timescale/</div>
              <div style={{ padding: '2px 0' }}><FileIcon type="dockerfile" />app.Dockerfile</div>
            </div>
          )}

          {/* SRC - The Main Event */}
          <div onClick={() => toggleFolder('src')} style={{ cursor: 'pointer', padding: '3px 0', fontWeight: 'bold' }}>
            <FolderIcon isOpen={expandedFolders['src']} />
            <span style={{ color: '#7c3aed' }}>src/</span>
          </div>
          {expandedFolders['src'] && (
            <div style={{ marginLeft: '20px' }}>
              {/* config.py */}
              <div style={{ padding: '2px 0' }}>
                <FileIcon type="py" />config.py
              </div>

              {/* Domain */}
              <div onClick={() => toggleFolder('domain')} style={{ cursor: 'pointer', padding: '3px 0' }}>
                <FolderIcon isOpen={expandedFolders['domain']} />
                <span style={{ color: layerColors.domain.text, fontWeight: '600' }}>domain/</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Pure Logic</span>
              </div>
              {expandedFolders['domain'] && (
                <div style={{ marginLeft: '20px' }}>
                  <div onClick={() => setSelectedFile('models.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'models.py' ? '#dcfce7' : 'transparent' }}>
                    <FileIcon type="py" />models.py
                  </div>
                  <div onClick={() => setSelectedFile('events.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'events.py' ? '#dcfce7' : 'transparent' }}>
                    <FileIcon type="py" />events.py
                  </div>
                  <div style={{ padding: '3px 0' }}>
                    <FolderIcon isOpen={true} />strategy/
                    <div style={{ marginLeft: '20px' }}>
                      <div onClick={() => setSelectedFile('base.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'base.py' ? '#dcfce7' : 'transparent' }}>
                        <FileIcon type="py" />base.py
                      </div>
                      <div onClick={() => setSelectedFile('golden_cross.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'golden_cross.py' ? '#dcfce7' : 'transparent' }}>
                        <FileIcon type="py" />golden_cross.py
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '3px 0' }}>
                    <FolderIcon isOpen={true} />risk/
                    <div style={{ marginLeft: '20px' }}>
                      <div onClick={() => setSelectedFile('rules.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'rules.py' ? '#dcfce7' : 'transparent' }}>
                        <FileIcon type="py" />rules.py
                      </div>
                      <div onClick={() => setSelectedFile('kill_switch.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'kill_switch.py' ? '#dcfce7' : 'transparent' }}>
                        <FileIcon type="py" />kill_switch.py
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ports */}
              <div onClick={() => toggleFolder('ports')} style={{ cursor: 'pointer', padding: '3px 0' }}>
                <FolderIcon isOpen={expandedFolders['ports']} />
                <span style={{ color: layerColors.ports.text, fontWeight: '600' }}>ports/</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Interfaces</span>
              </div>
              {expandedFolders['ports'] && (
                <div style={{ marginLeft: '20px' }}>
                  <div onClick={() => setSelectedFile('broker.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'broker.py' ? '#e0e7ff' : 'transparent' }}>
                    <FileIcon type="py" />broker.py
                  </div>
                  <div onClick={() => setSelectedFile('market_data.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'market_data.py' ? '#e0e7ff' : 'transparent' }}>
                    <FileIcon type="py" />market_data.py
                  </div>
                  <div onClick={() => setSelectedFile('persistence.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'persistence.py' ? '#e0e7ff' : 'transparent' }}>
                    <FileIcon type="py" />persistence.py
                  </div>
                </div>
              )}

              {/* Application */}
              <div onClick={() => toggleFolder('application')} style={{ cursor: 'pointer', padding: '3px 0' }}>
                <FolderIcon isOpen={expandedFolders['application']} />
                <span style={{ color: layerColors.application.text, fontWeight: '600' }}>application/</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Orchestration</span>
              </div>
              {expandedFolders['application'] && (
                <div style={{ marginLeft: '20px' }}>
                  <div onClick={() => setSelectedFile('bus.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'bus.py' ? '#fce7f3' : 'transparent' }}>
                    <FileIcon type="py" />bus.py
                  </div>
                  <div onClick={() => setSelectedFile('engine.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'engine.py' ? '#fce7f3' : 'transparent' }}>
                    <FileIcon type="py" />engine.py
                  </div>
                  <div onClick={() => setSelectedFile('fsm.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'fsm.py' ? '#fce7f3' : 'transparent' }}>
                    <FileIcon type="py" />fsm.py
                  </div>
                  <div onClick={() => setSelectedFile('position_tracker.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'position_tracker.py' ? '#fce7f3' : 'transparent' }}>
                    <FileIcon type="py" />position_tracker.py
                  </div>
                  <div onClick={() => setSelectedFile('services.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'services.py' ? '#fce7f3' : 'transparent' }}>
                    <FileIcon type="py" />services.py
                  </div>
                </div>
              )}

              {/* Adapters */}
              <div onClick={() => toggleFolder('adapters')} style={{ cursor: 'pointer', padding: '3px 0' }}>
                <FolderIcon isOpen={expandedFolders['adapters']} />
                <span style={{ color: layerColors.adapters.text, fontWeight: '600' }}>adapters/</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Implementations</span>
              </div>
              {expandedFolders['adapters'] && (
                <div style={{ marginLeft: '20px' }}>
                  <div style={{ padding: '3px 0' }}>
                    <FolderIcon isOpen={true} />market_data/
                    <div style={{ marginLeft: '20px' }}>
                      <div onClick={() => setSelectedFile('polygon.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'polygon.py' ? '#dbeafe' : 'transparent' }}>
                        <FileIcon type="py" />polygon.py
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '3px 0' }}>
                    <FolderIcon isOpen={true} />broker/
                    <div style={{ marginLeft: '20px' }}>
                      <div onClick={() => setSelectedFile('alpaca.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'alpaca.py' ? '#dbeafe' : 'transparent' }}>
                        <FileIcon type="py" />alpaca.py
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '3px 0' }}>
                    <FolderIcon isOpen={true} />persistence/
                    <div style={{ marginLeft: '20px' }}>
                      <div onClick={() => setSelectedFile('timescale.py')}
                           style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'timescale.py' ? '#dbeafe' : 'transparent' }}>
                        <FileIcon type="py" />timescale.py
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Infrastructure */}
              <div onClick={() => toggleFolder('infrastructure')} style={{ cursor: 'pointer', padding: '3px 0' }}>
                <FolderIcon isOpen={expandedFolders['infrastructure']} />
                <span style={{ color: layerColors.infrastructure.text, fontWeight: '600' }}>infrastructure/</span>
                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Utilities</span>
              </div>
              {expandedFolders['infrastructure'] && (
                <div style={{ marginLeft: '20px' }}>
                  <div onClick={() => setSelectedFile('logging.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'logging.py' ? '#f1f5f9' : 'transparent' }}>
                    <FileIcon type="py" />logging.py
                  </div>
                  <div onClick={() => setSelectedFile('idempotency.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'idempotency.py' ? '#f1f5f9' : 'transparent' }}>
                    <FileIcon type="py" />idempotency.py
                  </div>
                  <div onClick={() => setSelectedFile('clock.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'clock.py' ? '#f1f5f9' : 'transparent' }}>
                    <FileIcon type="py" />clock.py
                  </div>
                  <div onClick={() => setSelectedFile('resilience.py')}
                       style={{ cursor: 'pointer', padding: '2px 0', backgroundColor: selectedFile === 'resilience.py' ? '#f1f5f9' : 'transparent' }}>
                    <FileIcon type="py" />resilience.py
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tests */}
          <div onClick={() => toggleFolder('tests')} style={{ cursor: 'pointer', padding: '3px 0' }}>
            <FolderIcon isOpen={expandedFolders['tests']} />
            tests/
          </div>
          {expandedFolders['tests'] && (
            <div style={{ marginLeft: '20px' }}>
              <div style={{ padding: '2px 0' }}><FolderIcon isOpen={false} />unit/</div>
              <div style={{ padding: '2px 0' }}><FolderIcon isOpen={false} />integration/</div>
              <div style={{ padding: '2px 0' }}><FolderIcon isOpen={false} />e2e/</div>
            </div>
          )}

          {/* Scripts */}
          <div onClick={() => toggleFolder('scripts')} style={{ cursor: 'pointer', padding: '3px 0' }}>
            <FolderIcon isOpen={expandedFolders['scripts']} />
            scripts/
          </div>

          {/* Main */}
          <div onClick={() => setSelectedFile('main.py')}
               style={{ cursor: 'pointer', padding: '3px 0', backgroundColor: selectedFile === 'main.py' ? '#fef9c3' : 'transparent', fontWeight: '600' }}>
            <FileIcon type="py" />
            <span style={{ color: layerColors.main.text }}>main.py</span>
            <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>← Entry Point</span>
          </div>
          
          <div style={{ padding: '2px 0' }}><FileIcon type="md" />README.md</div>
        </div>
      )}
    </div>
  );

  const FileDetails = () => {
    if (!selectedFile || !fileDescriptions[selectedFile]) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#94a3b8',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👈</div>
          <div>Click any file to see its purpose and code</div>
        </div>
      );
    }

    const file = fileDescriptions[selectedFile];
    const colors = layerColors[file.layer] || layerColors.infrastructure;

    return (
      <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
        <div style={{ 
          backgroundColor: colors.bg, 
          border: `2px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: colors.text,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileIcon type="py" />
            {selectedFile}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
            <strong>Purpose:</strong> {file.purpose}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <strong>Contains:</strong> {file.contains}
          </div>
        </div>

        {file.code && (
          <div style={{ 
            backgroundColor: '#1e293b', 
            borderRadius: '8px',
            padding: '16px',
            overflow: 'auto'
          }}>
            <pre style={{ 
              margin: 0, 
              color: '#e2e8f0', 
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {file.code}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const FlowDiagram = () => (
    <div style={{ padding: '20px', overflow: 'auto' }}>
      {/* Visual Flow */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {flowSteps.map((step, idx) => (
          <div 
            key={step.id}
            onClick={() => setActiveFlowStep(idx)}
            style={{ 
              display: 'flex',
              alignItems: 'stretch',
              cursor: 'pointer',
              opacity: activeFlowStep === idx ? 1 : 0.7,
              transform: activeFlowStep === idx ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Step Number */}
            <div style={{
              width: '40px',
              minWidth: '40px',
              backgroundColor: step.color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              borderRadius: '8px 0 0 8px'
            }}>
              {step.id}
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              backgroundColor: activeFlowStep === idx ? '#f8fafc' : '#fff',
              border: `2px solid ${step.color}`,
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ fontWeight: 'bold', color: step.color }}>
                  {step.title}
                </span>
                <code style={{ 
                  fontSize: '10px', 
                  backgroundColor: '#f1f5f9', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  color: '#475569'
                }}>
                  {step.location}
                </code>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {step.description}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: '#94a3b8',
                fontFamily: 'monospace',
                marginTop: '4px'
              }}>
                ⚡ {step.dataFlow}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Connector Lines (visual) */}
      <div style={{ 
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 'bold', 
          marginBottom: '16px',
          color: '#334155'
        }}>
          HEXAGONAL ARCHITECTURE LAYERS
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {[
            { name: 'Domain', color: '#22c55e', desc: 'Pure Logic' },
            { name: 'Ports', color: '#6366f1', desc: 'Interfaces' },
            { name: 'Application', color: '#ec4899', desc: 'Orchestration' },
            { name: 'Adapters', color: '#3b82f6', desc: 'External I/O' },
            { name: 'Infrastructure', color: '#64748b', desc: 'Utilities' }
          ].map(layer => (
            <div 
              key={layer.name}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: `2px solid ${layer.color}`,
                textAlign: 'center',
                minWidth: '120px'
              }}
            >
              <div style={{ fontWeight: 'bold', color: layer.color, fontSize: '13px' }}>
                {layer.name}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                {layer.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Dependency Rule */}
        <div style={{ 
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fbbf24',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          <strong>🔒 DEPENDENCY RULE:</strong> Inner layers never import outer layers.
          <br/>
          Domain knows nothing about Alpaca, Polygon, or TimescaleDB.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: '#0f172a',
        color: 'white',
        padding: '20px 24px',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <h1 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '24px',
          fontWeight: '700',
          letterSpacing: '-0.5px'
        }}>
          🏛️ KYZLO QUANT PLATFORM
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Hexagonal Architecture · Event-Driven · Production-Grade
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setActiveView('structure')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeView === 'structure' ? '#3b82f6' : 'white',
            color: activeView === 'structure' ? 'white' : '#64748b',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          📁 Folder Structure
        </button>
        <button
          onClick={() => setActiveView('flow')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeView === 'flow' ? '#3b82f6' : 'white',
            color: activeView === 'flow' ? 'white' : '#64748b',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          ⚡ Data Flow
        </button>
      </div>

      {/* Content */}
      {activeView === 'structure' ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          minHeight: '600px'
        }}>
          {/* Left: Folder Tree */}
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            overflow: 'auto'
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#94a3b8', 
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              Click folders to expand · Click files to view details
            </div>
            <FolderStructure />
          </div>

          {/* Right: File Details */}
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <FileDetails />
          </div>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          minHeight: '600px'
        }}>
          <FlowDiagram />
        </div>
      )}

      {/* Legend */}
      <div style={{ 
        marginTop: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 'bold', 
          marginBottom: '12px',
          color: '#334155'
        }}>
          LAYER COLORS
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(layerColors).map(([name, colors]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: colors.bg,
                border: `2px solid ${colors.border}`,
                borderRadius: '4px'
              }} />
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KyzloArchitecture;
