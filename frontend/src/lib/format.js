import { AGENT_BY_ID } from './agents';

export const PER_AGENT = 'per-agent';
export const OFFLINE_MODEL = 'offline-demo';

/** "17 Nov 2026, 20:47" in the reader's own time zone (the API sends UTC with a Z suffix). */
export function formatDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { timeStyle: 'medium' });
}

/** "4.2 s" between two ISO timestamps, or '' when either is missing. */
export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso) - new Date(startIso);
  if (!(ms >= 0)) return '';
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

/** "google/gemma-4-31b-it:free" → "gemma-4-31b-it". */
export function shortModel(id) {
  if (!id) return '';
  if (id === PER_AGENT) return 'Per-agent models';
  if (id === OFFLINE_MODEL) return 'Offline demo';
  if (id === 'openrouter/free') return 'OpenRouter auto';
  return id
    .split('/')
    .pop()
    .replace(/:free$/, '');
}

/** "data_analyst_completed" → "Data analyst completed". */
export function eventLabel(event = '') {
  for (const suffix of ['started', 'completed', 'failed']) {
    if (event.endsWith(`_${suffix}`)) {
      const node = event.slice(0, -suffix.length - 1);
      return `${AGENT_BY_ID[node]?.label ?? node.replaceAll('_', ' ')} ${suffix}`;
    }
  }
  return event.replaceAll('_', ' ');
}

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const isFinished = (status) => status === 'completed' || status === 'failed';

/** Turn inline citations "[3]" into links to source 3 (not "[3](url)" links or "[3]:" definitions). */
export function linkCitations(markdown = '') {
  return markdown.replace(/\[(\d{1,3})\](?![(:])/g, '[$1](#source-$1)');
}
