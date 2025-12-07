from abc import ABC, abstractmethod
from typing import List


class NewsPort(ABC):
    """Abstract news/sentiment provider."""

    @abstractmethod
    async def fetch_headlines(self, symbol: str) -> List[str]:
        raise NotImplementedError
