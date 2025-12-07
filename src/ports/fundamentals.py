from abc import ABC, abstractmethod
from typing import Dict


class FundamentalsPort(ABC):
    """Abstract client for fundamentals."""

    @abstractmethod
    async def fetch_ratios(self, symbol: str) -> Dict[str, float]:
        raise NotImplementedError
