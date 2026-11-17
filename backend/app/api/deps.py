"""Request guards: per-IP sliding-window rate limits for the endpoints that spend LLM quota."""

import time
from collections import deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from app.config import settings


class RateLimiter:
    # shortcut: counters live in this process; with several instances, move them to Redis.
    def __init__(self, limit: Callable[[], int], window_s: float, what: str):
        self.limit, self.window_s, self.what = limit, window_s, what
        self.hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> None:
        now = time.monotonic()
        # Drop expired timestamps everywhere so idle IPs don't accumulate.
        for k in list(self.hits):
            dq = self.hits[k]
            while dq and dq[0] <= now - self.window_s:
                dq.popleft()
            if not dq:
                del self.hits[k]
        dq = self.hits.setdefault(key, deque())
        if len(dq) >= self.limit():
            retry_after = int(dq[0] + self.window_s - now) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Too many {self.what}. Try again in {retry_after} s.",
                headers={"Retry-After": str(retry_after)},
            )
        dq.append(now)

    def reset(self) -> None:
        self.hits.clear()


research_limiter = RateLimiter(lambda: settings.RESEARCH_RATE_LIMIT_PER_HOUR, 3600, "research runs this hour")
chat_limiter = RateLimiter(lambda: settings.CHAT_RATE_LIMIT_PER_MIN, 60, "chat messages this minute")


def client_ip(request: Request) -> str:
    # Behind Render's proxy, uvicorn --proxy-headers puts the real client address here.
    return request.client.host if request.client else "unknown"


def limit_research(request: Request) -> None:
    research_limiter.check(client_ip(request))


def limit_chat(request: Request) -> None:
    chat_limiter.check(client_ip(request))
