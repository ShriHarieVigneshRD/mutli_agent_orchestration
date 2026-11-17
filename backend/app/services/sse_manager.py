import asyncio
import json
import logging

logger = logging.getLogger("SSEManager")


class SSEManager:
    def __init__(self):
        # Maps run_id -> Set of asyncio Queues for connected subscribers
        self._subscribers: dict[str, set[asyncio.Queue]] = {}

    def subscribe(self, run_id: str) -> asyncio.Queue:
        if run_id not in self._subscribers:
            self._subscribers[run_id] = set()
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[run_id].add(queue)
        logger.info(f"New client subscribed to SSE for run: {run_id}")
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue):
        if run_id in self._subscribers:
            self._subscribers[run_id].discard(queue)
            if not self._subscribers[run_id]:
                del self._subscribers[run_id]
        logger.info(f"Client unsubscribed from SSE for run: {run_id}")

    async def broadcast(self, run_id: str, event_type: str, data: dict):
        event_payload = {"event": event_type, "run_id": run_id, "data": data}
        json_data = json.dumps(event_payload)

        if run_id in self._subscribers:
            for queue in list(self._subscribers[run_id]):
                await queue.put(json_data)

        logger.debug(f"Broadcasted event '{event_type}' for run '{run_id}'")


sse_manager = SSEManager()
