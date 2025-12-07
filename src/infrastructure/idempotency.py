import hashlib
import uuid
from uuid import UUID


def generate_signal_id(symbol: str, strategy_id: str, timestamp: float) -> UUID:
    """Deterministically generate a UUID for a signal."""
    base = f"{symbol}:{strategy_id}:{timestamp}".encode()
    digest = hashlib.sha256(base).hexdigest()
    return uuid.UUID(digest[:32])
