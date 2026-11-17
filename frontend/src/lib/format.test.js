import { describe, expect, it } from 'vitest';
import { applyEvent, nodesFromLogs } from '../hooks/useRun';
import { eventLabel, formatDuration, hostname, isFinished, linkCitations, shortModel } from './format';

describe('format helpers', () => {
  it('shortens model ids', () => {
    expect(shortModel('google/gemma-4-31b-it:free')).toBe('gemma-4-31b-it');
    expect(shortModel('per-agent')).toBe('Per-agent models');
    expect(shortModel('offline-demo')).toBe('Offline demo');
    expect(shortModel('openrouter/free')).toBe('OpenRouter auto');
    expect(shortModel('groq')).toBe('groq'); // legacy rows
  });

  it('labels events with every underscore replaced (B18)', () => {
    expect(eventLabel('data_analyst_completed')).toBe('Data analyst completed');
    expect(eventLabel('news_agent_started')).toBe('News agent started');
    expect(eventLabel('research_failed')).toBe('research failed');
  });

  it('formats durations', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:04.2Z')).toBe('4.2 s');
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:03:00Z')).toBe('3 min');
    expect(formatDuration(undefined, '2026-01-01T00:00:00Z')).toBe('');
  });

  it('links inline citations but not links or definitions', () => {
    expect(linkCitations('Costs fell [1] and [12].')).toBe('Costs fell [1](#source-1) and [12](#source-12).');
    expect(linkCitations('[1](https://x.org) and\n[2]: https://y.org')).toBe(
      '[1](https://x.org) and\n[2]: https://y.org',
    );
  });

  it('extracts hostnames safely', () => {
    expect(hostname('https://www.example.org/a')).toBe('example.org');
    expect(hostname('not a url')).toBe('');
    expect(isFinished('failed') && !isFinished('running')).toBe(true);
  });
});

describe('run state', () => {
  it('applies start, completion and failure events', () => {
    let nodes = applyEvent({}, { event: 'planner_started', at: 't0' });
    expect(nodes.planner).toMatchObject({ status: 'running', startedAt: 't0' });
    nodes = applyEvent(nodes, {
      event: 'planner_completed',
      at: 't1',
      data: { details: { status: 'degraded', model_used: 'm' } },
    });
    expect(nodes.planner).toMatchObject({ status: 'degraded', startedAt: 't0', finishedAt: 't1', passes: 1 });
    nodes = applyEvent(nodes, { event: 'writer_failed', data: { error: 'Daily limit' } });
    expect(nodes.writer).toMatchObject({ status: 'failed', details: { error: 'Daily limit' } });
    expect(applyEvent(nodes, { event: 'research_completed' })).toBe(nodes);
  });

  it('counts writer passes from stored logs', () => {
    const nodes = nodesFromLogs([
      { agent_name: 'writer', status: 'completed', details: { status: 'completed' } },
      { agent_name: 'writer', status: 'completed', details: { draft_report: 'v2' } },
      { agent_name: 'researcher', status: 'completed', details: { status: 'completed_with_no_results' } },
    ]);
    expect(nodes.writer.passes).toBe(2);
    expect(nodes.writer.details.draft_report).toBe('v2');
    expect(nodes.researcher.status).toBe('completed_with_no_results');
  });
});
