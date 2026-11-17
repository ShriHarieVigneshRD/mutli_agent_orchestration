import { describe, expect, it, vi } from 'vitest';
import {
  createResearchRun,
  getResearchHistory,
  getResearchRun,
  sendReportChatMessage,
  subscribeToRunEvents,
} from './api';

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });

describe('api client', () => {
  it('creates a run with a JSON body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ run_id: 'r1' }));
    const res = await createResearchRun('solar', 'openrouter/free');
    expect(res.run_id).toBe('r1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/research');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ query: 'solar', provider: 'openrouter/free' });
  });

  it('surfaces the API error detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ detail: 'Query cannot be empty' }, false));
    await expect(createResearchRun('')).rejects.toThrow('Query cannot be empty');
  });

  it('throws when a run or history cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, false));
    await expect(getResearchRun('x')).rejects.toThrow();
    await expect(getResearchHistory()).rejects.toThrow();
  });

  it('sends chat messages', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ chat_response: 'ok' }));
    await sendReportChatMessage('r1', 'hello');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/research/r1/chat');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'hello' });
  });

  it('parses SSE messages and closes the stream', () => {
    const instances = [];
    vi.stubGlobal(
      'EventSource',
      class {
        constructor(url) {
          this.url = url;
          this.close = vi.fn();
          instances.push(this);
        }
      },
    );
    const onEvent = vi.fn();
    const close = subscribeToRunEvents('r1', onEvent);
    instances[0].onmessage({ data: JSON.stringify({ event: 'planner_completed', data: {} }) });
    expect(instances[0].url).toBe('/api/research/r1/stream');
    expect(onEvent).toHaveBeenCalledWith({ event: 'planner_completed', data: {} });
    close();
    expect(instances[0].close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
