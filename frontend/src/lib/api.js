const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/** fetch + JSON with the API's `detail` message on errors. */
async function request(path, init) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error('Cannot reach the research server. Check your connection and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

const postJson = (path, payload) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** `models` is { mode: 'per_agent' | 'single', model?: string }. */
export function createResearchRun(query, models = { mode: 'per_agent' }) {
  return postJson('/api/research', {
    query,
    model_mode: models.mode,
    model: models.mode === 'single' ? models.model : undefined,
  });
}

export const getResearchRun = (runId) => request(`/api/research/${runId}`);

export const getResearchHistory = ({ limit = 20, offset = 0 } = {}) =>
  request(`/api/history?limit=${limit}&offset=${offset}`);

export const deleteResearchRun = (runId) => request(`/api/research/${runId}`, { method: 'DELETE' });

export const getModels = () => request('/api/models');

export const getReportChat = (runId) => request(`/api/research/${runId}/chat`);

export const sendReportChatMessage = (runId, message) => postJson(`/api/research/${runId}/chat`, { message });

export const revertReport = (runId) => postJson(`/api/research/${runId}/report/revert`, {});

/**
 * Live run events. The server replays everything sent so far on every (re)connect, so `onReset`
 * fires on each `connected` event and the caller should drop what it had before the replay.
 * Returns a function that closes the stream.
 */
export function subscribeToRunEvents(runId, { onEvent, onReset, onStatus } = {}) {
  const source = new EventSource(`${API_BASE_URL}/api/research/${runId}/stream`);

  source.addEventListener('connected', () => {
    onReset?.();
    onStatus?.('live');
  });
  source.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent?.(parsed);
      if (parsed.event === 'research_completed' || parsed.event === 'research_failed') {
        source.close();
        onStatus?.('closed');
      }
    } catch {
      // A malformed frame is skipped; the next replay or the final refetch restores state.
    }
  };
  source.onerror = () => {
    onStatus?.(source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting');
  };

  return () => source.close();
}
