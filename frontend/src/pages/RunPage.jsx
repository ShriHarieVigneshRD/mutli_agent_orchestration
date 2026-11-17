import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AgentOutput } from '../components/AgentOutput';
import ReportChat from '../components/ReportChat';
import ReportViewer from '../components/ReportViewer';
import { RoutingSlip, WireLog } from '../components/RoutingSlip';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/States';
import { useRun } from '../hooks/useRun';
import { AGENT_BY_ID } from '../lib/agents';
import { revertReport } from '../lib/api';
import { eventLabel, formatDateTime, isFinished, shortModel } from '../lib/format';

const LONG_QUERY = 220;

/** The desk most recently touched by a live event, so the main column follows the work. */
function lastActiveDesk(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const node = events[i].event?.match(/^(.*)_(started|completed|failed)$/)?.[1];
    if (node && AGENT_BY_ID[node]) return node;
  }
  return null;
}

function RunStatus({ status, connection }) {
  if (status === 'completed') return <StatusBadge status="completed" label="Finished" />;
  if (status === 'failed') return <StatusBadge status="failed" />;
  return <StatusBadge status="running" label={connection === 'reconnecting' ? 'Reconnecting…' : 'Live'} />;
}

function ReportPending({ run }) {
  return (
    <Panel>
      {run.status === 'failed' ? (
        <EmptyState icon={FileText} title="No report was written.">
          {run.error_message || 'The run failed before the writer finished.'} The desks that did run are still
          listed on the left.
        </EmptyState>
      ) : (
        <div className="p-6">
          <p className="mb-4 text-sm text-ink-3">The report appears here once the critic approves a draft.</p>
          <Skeleton lines={6} />
        </div>
      )}
    </Panel>
  );
}

/** Keyed by run id so navigating between runs starts from a clean slate. */
export default function RunRoute({ catalogue }) {
  const { runId } = useParams();
  return <RunPage key={runId} runId={runId} catalogue={catalogue} />;
}

function RunPage({ runId, catalogue }) {
  const { run, setRun, nodes, events, connection, error, refresh } = useRun(runId);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [undo, setUndo] = useState({ busy: false, error: '' });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
        <ErrorNotice message={error} onRetry={() => refresh().catch(() => {})} />
        <Link to="/history" className="text-sm text-accent hover:underline">
          Back to history
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8 md:px-6 xl:px-8" aria-busy="true">
        <Skeleton lines={2} className="mb-8 max-w-2xl" />
        <Skeleton lines={8} />
      </div>
    );
  }

  const finished = isFinished(run.status);
  const latest = lastActiveDesk(events);
  // Default view: the report when there is one; for a failed run the desk that failed (or the report pane,
  // which explains why there is none); while live, whichever desk is working.
  const failedDesk = Object.keys(nodes).find((id) => nodes[id].status === 'failed');
  const autoView = run.report
    ? 'report'
    : run.status === 'failed'
      ? failedDesk || 'report'
      : latest || 'planner';
  const view = selected ?? autoView;
  const longQuery = run.query.length > LONG_QUERY;

  const updateReport = (patch) => setRun((r) => ({ ...r, report: { ...r.report, ...patch } }));

  const onUndo = async () => {
    setUndo({ busy: true, error: '' });
    try {
      const res = await revertReport(runId);
      updateReport({ full_markdown: res.full_markdown, version_count: res.version_count });
      setUndo({ busy: false, error: '' });
    } catch (e) {
      setUndo({ busy: false, error: e.message });
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8 xl:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-4xl flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <RunStatus status={run.status} connection={connection} />
            <time dateTime={run.created_at}>{formatDateTime(run.created_at)}</time>
            <span aria-hidden>·</span>
            <span className="font-mono">{shortModel(run.provider)}</span>
            {run.revision_count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {run.revision_count} revision{run.revision_count > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <h1
            className={`mt-2 font-serif text-2xl leading-tight font-semibold tracking-tight text-ink [overflow-wrap:anywhere] md:text-3xl ${
              longQuery && !expanded ? 'line-clamp-3' : ''
            }`}
          >
            {run.query}
          </h1>
          {longQuery && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-accent hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Show the full question'}
            </button>
          )}
          <p className="sr-only" aria-live="polite">
            {events.length ? eventLabel(events[events.length - 1].event) : ''}
          </p>
        </div>
        <Button as={Link} to="/" variant="secondary" className="max-md:hidden">
          <Plus aria-hidden className="h-4 w-4" /> New research
        </Button>
      </header>

      {run.status === 'failed' && run.error_message && (
        <ErrorNotice className="mb-6" message={run.error_message} />
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="min-w-0 lg:sticky lg:top-20">
          <Panel>
            <RoutingSlip
              nodes={nodes}
              selected={view}
              onSelect={setSelected}
              runStatus={run.status}
              hasReport={Boolean(run.report)}
              modelSetting={run.provider}
              catalogue={catalogue}
            />
            <WireLog events={events} finished={finished} />
          </Panel>
        </aside>

        <div className="min-w-0 space-y-6">
          {view === 'report' ? (
            run.report ? (
              <>
                <ErrorNotice message={undo.error} />
                <ReportViewer
                  report={run.report}
                  sources={run.sources}
                  onUndo={onUndo}
                  undoBusy={undo.busy}
                />
                <ReportChat
                  key={run.id}
                  runId={run.id}
                  onReportUpdated={(md, versionCount) =>
                    updateReport({
                      full_markdown: md,
                      version_count: versionCount ?? (run.report.version_count || 0) + 1,
                    })
                  }
                />
              </>
            ) : (
              <ReportPending run={run} />
            )
          ) : (
            <AgentOutput agentId={view} node={nodes[view]} runFinished={finished} />
          )}
        </div>
      </div>
    </div>
  );
}
