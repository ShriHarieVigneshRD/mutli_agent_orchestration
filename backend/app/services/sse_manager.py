"""In-process pub/sub for run progress, with replay so late or reconnecting clients miss nothing."""

import asyncio
import json
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)

TERMINAL_EVENTS = {"research_completed", "research_failed"}
MAX_RUNS_KEPT = 50  # replay history is kept for the most recent runs only


class SSEManager:
    # shortcut: state lives in this process; with several workers, move it to Redis pub/sub.
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[str]]] = {}
        self._history: OrderedDict[str, list[str]] = OrderedDict()

    def subscribe(self, run_id: str) -> asyncio.Queue[str]:
        """A queue pre-filled with every event already sent for this run."""
        queue: asyncio.Queue[str] = asyncio.Queue()
        for payload in self._history.get(run_id, []):
            queue.put_nowait(payload)
        self._subscribers.setdefault(run_id, set()).add(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[str]) -> None:
        subscribers = self._subscribers.get(run_id)
        if subscribers is not None:
            subscribers.discard(queue)
            if not subscribers:
                del self._subscribers[run_id]

    def has_history(self, run_id: str) -> bool:
        return run_id in self._history

    async def broadcast(self, run_id: str, event_type: str, data: dict) -> None:
        payload = json.dumps({"event": event_type, "run_id": run_id, "data": data})
        self._history.setdefault(run_id, []).append(payload)
        self._history.move_to_end(run_id)
        while len(self._history) > MAX_RUNS_KEPT:
            self._history.popitem(last=False)
        for queue in list(self._subscribers.get(run_id, ())):
            queue.put_nowait(payload)


def is_terminal(payload: str) -> bool:
    return json.loads(payload).get("event") in TERMINAL_EVENTS


sse_manager = SSEManager()
