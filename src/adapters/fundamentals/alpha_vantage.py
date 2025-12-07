from typing import Dict

from ...ports.fundamentals import FundamentalsPort


class AlphaVantageClient(FundamentalsPort):
    """Stubbed fundamentals client returning static ratios."""

    async def fetch_ratios(self, symbol: str) -> Dict[str, float]:
        return {"pe": 15.0, "pb": 2.0, "symbol": symbol}  # type: ignore[return-value]
