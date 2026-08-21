const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function createResearchRun(query, provider = 'groq') {
  const response = await fetch(`${API_BASE_URL}/api/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, provider }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to initiate research run');
  }
  return response.json();
}

export async function getResearchRun(runId) {
  const response = await fetch(`${API_BASE_URL}/api/research/${runId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch research run details');
  }
  return response.json();
}

export async function getResearchHistory() {
  const response = await fetch(`${API_BASE_URL}/api/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch research history');
  }
  return response.json();
}

export async function getReportById(reportId) {
  const response = await fetch(`${API_BASE_URL}/api/history/reports/${reportId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch report');
  }
  return response.json();
}

export function subscribeToRunEvents(runId, onEvent, onError) {
  const eventSource = new EventSource(`${API_BASE_URL}/api/research/${runId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent(parsed);
    } catch (err) {
      console.error('SSE JSON parse error:', err, event.data);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE EventSource error:', err);
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}
