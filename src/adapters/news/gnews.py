from typing import List

from ...ports.news import NewsPort


class GNewsClient(NewsPort):
    """Stubbed news client returning canned headlines."""

    async def fetch_headlines(self, symbol: str) -> List[str]:
        return [f"{symbol} reaches new milestone", "Market remains volatile"]
