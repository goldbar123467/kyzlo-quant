<div align="center">

```
██╗  ██╗██╗   ██╗███████╗██╗      ██████╗ 
██║ ██╔╝╚██╗ ██╔╝╚══███╔╝██║     ██╔═══██╗
█████╔╝  ╚████╔╝   ███╔╝ ██║     ██║   ██║
██╔═██╗   ╚██╔╝   ███╔╝  ██║     ██║   ██║
██║  ██╗   ██║   ███████╗███████╗╚██████╔╝
╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝ ╚═════╝ 
```

### **Q U A N T &nbsp; P L A T F O R M**

<br>

[![Status](https://img.shields.io/badge/STATUS-CODE_COMPLETE-00C853?style=for-the-badge&labelColor=1a1a2e)](/)
[![Python](https://img.shields.io/badge/PYTHON-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=1a1a2e)](https://python.org)
[![Architecture](https://img.shields.io/badge/HEXAGONAL-ARCHITECTURE-FF6B35?style=for-the-badge&labelColor=1a1a2e)](/)
[![Database](https://img.shields.io/badge/TIMESCALE-DB-FDB515?style=for-the-badge&logo=timescale&logoColor=white&labelColor=1a1a2e)](https://timescale.com)
[![License](https://img.shields.io/badge/LICENSE-MIT-00C853?style=for-the-badge&labelColor=1a1a2e)](/LICENSE)

<br>

*A production-grade, event-driven algorithmic trading platform*  
*Built for zero engineering alpha drag*

<br>

[Getting Started](#-quick-start) · [Architecture](#-system-architecture) · [Features](#-features) · [Configuration](#-configuration)

---

</div>

<br>

## ◈ &nbsp; Philosophy

> *"The edge isn't in the alpha. It's in the architecture."*

**Kyzlo** moves beyond simple scripts. By implementing **Hexagonal Architecture (Ports & Adapters)**, we decouple trading logic from external infrastructure—enabling seamless broker swaps, bulletproof testing, and institutional-grade reliability.

<br>

---

<br>

## ◈ &nbsp; System Architecture

<div align="center">

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      A D A P T E R S                        │
                    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
                    │  │ Alpaca  │  │ Polygon │  │Timescale│  │ AlphaVantage +  │ │
                    │  │ Broker  │  │ Stream  │  │  Repo   │  │     GNews       │ │
                    │  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
                    └───────┼────────────┼───────────┼─────────────────┼──────────┘
                            │            │           │                 │
                            ▼            ▼           ▼                 ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                  A P P L I C A T I O N                      │
                    │         ┌──────────────────────────────────────┐            │
                    │         │        ⚡ Async Event Bus ⚡          │            │
                    │         └──────────────────────────────────────┘            │
                    │    ┌────────────────┐      ┌────────────────┐               │
                    │    │ExecutionService│      │  RiskService   │               │
                    │    └────────┬───────┘      └───────┬────────┘               │
                    └─────────────┼──────────────────────┼────────────────────────┘
                                  │                      │
                                  ▼                      ▼
                    ╔═════════════════════════════════════════════════════════════╗
                    ║                       D O M A I N                           ║
                    ║  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────────┐  ║
                    ║  │ Models  │ │ Events  │ │ Strategy │ │    Risk Rules    │  ║
                    ║  └─────────┘ └─────────┘ └──────────┘ └──────────────────┘  ║
                    ║                                                             ║
                    ║                    ✓ Pure Logic · Zero I/O                  ║
                    ╚═════════════════════════════════════════════════════════════╝
```

</div>

<br>

### The Dependency Rule

**Dependencies point inwards.** The Domain knows nothing of the outside world.

<br>

| Layer | Purpose | Components |
|:------|:--------|:-----------|
| **Domain** | Pure business logic | `Models` · `Events` · `Strategy` · `Risk Rules` |
| **Application** | Orchestration & state | `EventBus` · `ExecutionService` · `RiskService` |
| **Adapters** | External integrations | `AlpacaBroker` · `PolygonStream` · `TimescaleRepo` |
| **Infrastructure** | Resilience patterns | `CircuitBreakers` · `Idempotency` · `KillSwitch` |

<br>

---

<br>

## ◈ &nbsp; Features

<table>
<tr>
<td width="50%">

### ⚙️ &nbsp; Trading Engine
- **Strategy**: Golden Cross (SMA Crossover)
- Configurable fast/slow windows
- Event-driven signal generation
- Paper & live execution modes

</td>
<td width="50%">

### 🛡️ &nbsp; Risk Management
- Pre-trade buying power checks
- Position concentration limits
- Daily loss circuit breakers
- Automatic kill switch on drawdown

</td>
</tr>
<tr>
<td width="50%">

### 📊 &nbsp; Data Infrastructure
- Bitemporal tick storage
- Signal audit trail
- Order & fill persistence
- Ring buffer market data

</td>
<td width="50%">

### 🔒 &nbsp; Reliability
- Circuit breaker patterns
- Deterministic UUID generation
- Exactly-once execution semantics
- Crash-safe recovery

</td>
</tr>
</table>

<br>

---

<br>

## ◈ &nbsp; Quick Start

<br>

### Prerequisites

```
Docker Desktop          Virtualization enabled
Python                  3.11+
```

<br>

### 1 &nbsp;│&nbsp; Clone & Navigate

```bash
git clone https://github.com/goldbar123467/kyzlo-quant.git
cd kyzlo-quant
```

<br>

### 2 &nbsp;│&nbsp; Configuration

Create `.env` in the project root:

```ini
# ═══════════════════════════════════════════════════════════════
#  K Y Z L O   C O N F I G U R A T I O N
# ═══════════════════════════════════════════════════════════════

# ── Market Data ──────────────────────────────────────────────────
POLYGON_API_KEY=your_polygon_key

# ── Execution ────────────────────────────────────────────────────
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret

# ── Intelligence ─────────────────────────────────────────────────
ALPHA_VANTAGE_API_KEY=your_alphavantage_key
GNEWS_API_KEY=your_gnews_key

# ── Persistence ──────────────────────────────────────────────────
POSTGRES_USER=kyzlo
POSTGRES_PASSWORD=secure_password
TIMESCALE_CONNECTION_STRING=postgresql://kyzlo:secure_password@timescale:5432/kyzlo_quant
```

<br>

### 3 &nbsp;│&nbsp; Launch

```bash
docker-compose up -d
```

<br>

---

<br>

## ◈ &nbsp; Adapter Matrix

<br>

<div align="center">

| Function | Provider | Protocol | Status |
|:---------|:---------|:---------|:------:|
| Execution | Alpaca | REST / WS | `✓ Live` |
| Market Data | Polygon | WebSocket | `✓ Live` |
| Persistence | TimescaleDB | AsyncPG | `✓ Live` |
| Fundamentals | Alpha Vantage | REST | `✓ Live` |
| Sentiment | GNews | REST | `✓ Live` |

</div>

<br>

---

<br>

<div align="center">

### Built by **Clark Kitchen**

<br>

```
        ╱╲
       ╱  ╲
      ╱ ◈  ╲
     ╱──────╲
    ╱   ██   ╲
   ╱    ██    ╲
  ╱─────██─────╲
 ╱      ██      ╲
╱────────────────╲
```

<br>

*Where alpha meets architecture*

<br>

[![GitHub](https://img.shields.io/badge/GitHub-goldbar123467-181717?style=for-the-badge&logo=github)](https://github.com/goldbar123467)
[![X](https://img.shields.io/badge/X-@clarkkitchen22-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/clarkkitchen22)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Clark_Kitchen-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/clark-kitchen-37540219b/)

</div>
