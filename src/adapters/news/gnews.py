from typing import List

from ...ports.news import NewsPort


class GNewsClient(NewsPort):
    """Stubbed news client returning canned headlines."""

    def __init__(self, api_key: str, endpoint: str) -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    async def fetch_headlines(self, symbol: str) -> List[str]:
        return [f"{symbol} reaches new milestone", "Market remains volatile"]
