import { useCallback, useEffect, useRef, useState } from 'react';
import { getResearchRun, subscribeToRunEvents } from '../lib/api';
import { isFinished } from '../lib/format';

const POLL_MS = 5000;

/** Node state from stored agent logs (finished runs, or after a live run completes). */
export function nodesFromLogs(logs = []) {
  const nodes = {};
  for (const log of logs) {
    const prev = nodes[log.agent_name];
    nodes[log.agent_name] = {
      status: log.status === 'completed' ? log.details?.status || 'completed' : log.status,
      details: log.details || {},
      finishedAt: log.timestamp,
      passes: (prev?.passes || 0) + 1,
    };
  }
  return nodes;
}

/** Apply one SSE event to the node map. Pure, so it is easy to test. */
export function applyEvent(nodes, { event = '', data = {}, at }) {
  const match = event.match(/^(.*)_(started|completed|failed)$/);
  if (!match || match[1] === 'research') return nodes;
  const [, node, phase] = match;
  const prev = nodes[node] || {};
  if (phase === 'started') {
    return { ...nodes, [node]: { ...prev, status: 'running', startedAt: at } };
  }
  if (phase === 'failed') {
    return {
      ...nodes,
      [node]: { ...prev, status: 'failed', details: { error: data.error }, finishedAt: at },
    };
  }
  return {
    ...nodes,
    [node]: {
      status: data.details?.status || 'completed',
      details: data.details || {},
      startedAt: prev.startedAt,
      finishedAt: at,
      passes: (prev.passes || 0) + 1,
    },
  };
}

/**
 * Everything the run page shows: the stored run, live node states and the event log.
 * Live runs stream over SSE (the server replays past events on every connect); if the stream
 * cannot be kept open, the run is polled until it finishes. Mount once per run id (key={runId}).
 */
export function useRun(runId) {
  const [run, setRun] = useState(null);
  const [nodes, setNodes] = useState({});
  const [events, setEvents] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const liveRef = useRef(false);

  const refresh = useCallback(
    () =>
      getResearchRun(runId).then((data) => {
        setRun(data);
        if (isFinished(data.status)) {
          liveRef.current = false;
          setNodes((live) => {
            const stored = nodesFromLogs(data.logs);
            // Keep live start times so durations survive the final refetch.
            for (const [id, node] of Object.entries(stored)) node.startedAt = live[id]?.startedAt;
            return stored;
          });
        }
        return data;
      }),
    [runId],
  );

  useEffect(() => {
    let cancelled = false;
    let close = () => {};
    let pollTimer;

    const poll = () => {
      pollTimer = setTimeout(async () => {
        try {
          const data = await refresh();
          if (!cancelled && !isFinished(data.status)) poll();
        } catch {
          if (!cancelled) poll();
        }
      }, POLL_MS);
    };

    refresh()
      .then((data) => {
        if (cancelled) return;
        if (isFinished(data.status)) {
          setConnection('closed');
          return;
        }
        liveRef.current = true;
        close = subscribeToRunEvents(runId, {
          onReset: () => {
            setEvents([]);
            setNodes({});
          },
          onEvent: (evt) => {
            setEvents((prev) => [...prev, evt]);
            setNodes((prev) => applyEvent(prev, evt));
            if (evt.event === 'research_completed' || evt.event === 'research_failed') {
              liveRef.current = false; // finished normally: the stream closing next is expected
              refresh();
            }
          },
          onStatus: (status) => {
            setConnection(status);
            if (status === 'closed' && liveRef.current) poll(); // stream gave up before the run finished
          },
        });
      })
      .catch((e) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      liveRef.current = false;
      clearTimeout(pollTimer);
      close();
    };
  }, [runId, refresh]);

  return { run, setRun, nodes, events, connection, error, refresh };
}
