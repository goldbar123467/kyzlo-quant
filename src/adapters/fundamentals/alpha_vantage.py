from typing import Dict

from ...ports.fundamentals import FundamentalsPort


class AlphaVantageClient(FundamentalsPort):
    """Stubbed fundamentals client returning static ratios."""

    def __init__(self, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url

    async def fetch_ratios(self, symbol: str) -> Dict[str, float]:
        return {"pe": 15.0, "pb": 2.0, "symbol": symbol}  # type: ignore[return-value]
