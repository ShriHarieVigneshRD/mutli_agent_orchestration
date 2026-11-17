import { describe, expect, it, vi } from 'vitest';
import {
  createResearchRun,
  deleteResearchRun,
  getResearchHistory,
  getResearchRun,
  revertReport,
  sendReportChatMessage,
  subscribeToRunEvents,
} from './api';

const jsonResponse = (body, ok = true, status = 200) => ({ ok, status, json: () => Promise.resolve(body) });

describe('api client', () => {
  it('creates a per-agent run by default', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ run_id: 'r1' }));
    expect((await createResearchRun('solar')).run_id).toBe('r1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/research');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ query: 'solar', model_mode: 'per_agent' });
  });

  it('sends the chosen model in single-model mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ run_id: 'r1' }));
    await createResearchRun('solar', { mode: 'single', model: 'openrouter/free' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      query: 'solar',
      model_mode: 'single',
      model: 'openrouter/free',
    });
  });

  it('surfaces the API error detail and status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ detail: 'Too many research runs' }, false, 429),
    );
    await expect(createResearchRun('solar')).rejects.toMatchObject({
      message: 'Too many research runs',
      status: 429,
    });
  });

  it('explains network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getResearchRun('x')).rejects.toThrow(/Cannot reach the research server/);
  });

  it('pages history and calls the run endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
    await getResearchHistory({ limit: 5, offset: 10 });
    await deleteResearchRun('r1');
    await revertReport('r1');
    await sendReportChatMessage('r1', 'hello');
    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method || 'GET'} ${url}`);
    expect(calls).toEqual([
      'GET /api/history?limit=5&offset=10',
      'DELETE /api/research/r1',
      'POST /api/research/r1/report/revert',
      'POST /api/research/r1/chat',
    ]);
  });

  it('streams events, resets on reconnect and closes after the run finishes', () => {
    const instances = [];
    vi.stubGlobal(
      'EventSource',
      class {
        static CLOSED = 2;
        constructor(url) {
          this.url = url;
          this.listeners = {};
          this.readyState = 1;
          this.close = vi.fn();
          instances.push(this);
        }
        addEventListener(name, fn) {
          this.listeners[name] = fn;
        }
      },
    );
    const onEvent = vi.fn();
    const onReset = vi.fn();
    const onStatus = vi.fn();
    subscribeToRunEvents('r1', { onEvent, onReset, onStatus });
    const source = instances[0];
    expect(source.url).toBe('/api/research/r1/stream');

    source.listeners.connected();
    expect(onReset).toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith('live');

    source.onmessage({ data: JSON.stringify({ event: 'planner_completed', data: {} }) });
    expect(onEvent).toHaveBeenCalledWith({ event: 'planner_completed', data: {} });

    source.onerror();
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting');

    source.onmessage({ data: JSON.stringify({ event: 'research_completed', data: {} }) });
    expect(source.close).toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith('closed');
    vi.unstubAllGlobals();
  });
});
