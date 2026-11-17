import { CornerDownLeft, FileText } from 'lucide-react';
import { Fragment } from 'react';
import { AGENTS, KIND_LABELS, TOOL_ONLY } from '../lib/agents';
import {
  OFFLINE_MODEL,
  PER_AGENT,
  eventLabel,
  formatDuration,
  formatTime,
  isFinished,
  shortModel,
} from '../lib/format';
import { StatusBadge } from './ui/Badge';

/** The model an agent should have used first; anything else means a fallback tier answered. */
function primaryModel(agent, modelSetting, catalogue) {
  if (modelSetting && modelSetting !== PER_AGENT) return modelSetting;
  return catalogue?.kinds.find((k) => k.kind === agent.kind)?.model;
}

function AgentMeta({ agent, node, modelSetting, catalogue }) {
  const used = node?.details?.model_used;
  const fallback =
    used && used !== OFFLINE_MODEL && catalogue && used !== primaryModel(agent, modelSetting, catalogue);
  const parts = [KIND_LABELS[agent.kind]];
  if (TOOL_ONLY.has(agent.id)) parts.push('search tool');
  const duration = formatDuration(node?.startedAt, node?.finishedAt);
  return (
    <span className="block truncate text-xs text-ink-3 max-lg:hidden">
      {parts.join(' · ')}
      {used && (
        <>
          {' · '}
          <span className="font-mono">{shortModel(used)}</span>
          {fallback && <span className="text-caution"> (fallback)</span>}
        </>
      )}
      {duration && <span className="tabular-nums"> · {duration}</span>}
    </span>
  );
}

function Row({ index, icon: Icon, label, status, statusLabel, selected, onSelect, children, indent }) {
  return (
    <li className={`max-lg:shrink-0 ${indent ? 'lg:ml-4 lg:border-l lg:border-rule-strong lg:pl-2' : ''}`}>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        className={`flex w-full items-start gap-3 rounded-control px-2.5 py-2 text-left transition-colors duration-150 max-lg:h-11 max-lg:items-center max-lg:gap-2 ${
          selected ? 'bg-well shadow-[inset_2px_0_0_var(--accent)]' : 'hover:bg-well/60'
        }`}
      >
        <span className="pt-0.5 font-mono text-xs text-ink-4 tabular-nums max-lg:hidden">
          {String(index).padStart(2, '0')}
        </span>
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink-3 lg:hidden" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-sm ${selected ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}
            >
              {label}
            </span>
            <StatusBadge status={status} label={statusLabel} />
          </span>
          {children}
        </span>
      </button>
    </li>
  );
}

/**
 * The pipeline as a routing slip: one row per desk, the report last. Selecting a row shows that
 * desk's output. Vertical on desktop, a scrollable strip below 1024 px.
 */
export function RoutingSlip({ nodes, selected, onSelect, runStatus, hasReport, modelSetting, catalogue }) {
  const finished = isFinished(runStatus);
  const writerPasses = nodes.writer?.passes || 0;

  const reportStatus = hasReport ? 'completed' : runStatus === 'failed' ? 'failed' : 'waiting';

  return (
    <nav aria-label="Pipeline desks">
      <ol className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:thin] lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {AGENTS.map((agent, i) => {
          const node = nodes[agent.id];
          const status = node?.status || 'waiting';
          return (
            <Fragment key={agent.id}>
              {agent.id === 'researcher' && (
                <li aria-hidden className="px-2.5 pt-2 pb-0.5 text-[0.75rem] text-ink-4 max-lg:hidden">
                  In parallel
                </li>
              )}
              <Row
                index={i + 1}
                icon={agent.icon}
                label={agent.label}
                status={status}
                statusLabel={!node && finished ? 'Not run' : undefined}
                selected={selected === agent.id}
                onSelect={() => onSelect(agent.id)}
                indent={agent.parallel}
              >
                <AgentMeta agent={agent} node={node} modelSetting={modelSetting} catalogue={catalogue} />
              </Row>
              {agent.id === 'critic' && writerPasses > 1 && (
                <li className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-pencil max-lg:hidden">
                  <CornerDownLeft aria-hidden className="h-3.5 w-3.5" />
                  Returned to the writer {writerPasses - 1}×
                </li>
              )}
            </Fragment>
          );
        })}
        <li aria-hidden className="mx-2.5 my-1 border-t border-rule max-lg:hidden" />
        <Row
          index={8}
          icon={FileText}
          label="Report"
          status={reportStatus}
          selected={selected === 'report'}
          onSelect={() => onSelect('report')}
        />
      </ol>
    </nav>
  );
}

export function WireLog({ events, finished }) {
  return (
    <details className="group border-t border-rule">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-4 text-xs text-ink-3 hover:text-ink">
        <span>
          Event log{' '}
          <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
        </span>
        <span className="font-mono tabular-nums">{events.length}</span>
      </summary>
      {events.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-ink-3">
          {finished
            ? 'This run finished before you opened it; see each desk for its output.'
            : 'Waiting for events…'}
        </p>
      ) : (
        <ol className="max-h-72 space-y-1 overflow-y-auto px-4 pb-4 font-mono text-xs">
          {events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <time className="shrink-0 text-ink-4 tabular-nums">{formatTime(e.at)}</time>
              <span
                className={
                  e.event?.endsWith('failed')
                    ? 'text-pencil'
                    : e.event?.endsWith('completed')
                      ? 'text-ink-2'
                      : 'text-ink-3'
                }
              >
                {eventLabel(e.event)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
