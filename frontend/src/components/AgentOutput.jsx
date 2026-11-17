import { CircleCheck, CircleDashed, ExternalLink, Inbox } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AGENTS, AGENT_BY_ID, KIND_LABELS } from '../lib/agents';
import { hostname, shortModel } from '../lib/format';
import { Badge, StatusBadge } from './ui/Badge';
import { Panel } from './ui/Panel';
import { EmptyState, ErrorNotice, Skeleton } from './ui/States';

function SectionTitle({ children }) {
  return <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">{children}</h3>;
}

function FindingList({ items, emptyText }) {
  if (!items?.length) return <EmptyState icon={Inbox} title={emptyText} />;
  return (
    <ol className="divide-y divide-rule">
      {items.map((f, i) => (
        <li key={`${f.url}-${i}`} className="py-3 first:pt-0 last:pb-0">
          {f.url ? (
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-start gap-1 font-medium text-ink hover:text-accent"
            >
              <span className="[overflow-wrap:anywhere]">{f.title}</span>
              <ExternalLink
                aria-hidden
                className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-4 group-hover:text-accent"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="font-medium text-ink">{f.title}</p>
          )}
          <p className="text-xs text-ink-3">
            {[hostname(f.url), f.source_type === 'news' ? 'news' : null, f.timestamp]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {f.content && (
            <div className="report report-compact mt-1 text-sm text-ink-2 [&_p]:mb-1 [&_ul]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.content}</ReactMarkdown>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function PlanView({ plan }) {
  if (!plan) return null;
  const queries = Object.entries(plan.agent_prompts || {});
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Tasks</SectionTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink marker:font-mono marker:text-ink-4">
          {(plan.tasks || []).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>
      {queries.length > 0 && (
        <div>
          <SectionTitle>Search queries handed out</SectionTitle>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {queries.map(([agent, q]) => (
              <div key={agent} className="contents">
                <dt className="text-ink-3">{AGENT_BY_ID[agent]?.label ?? agent}</dt>
                <dd className="font-mono text-xs leading-5 text-ink [overflow-wrap:anywhere]">{q}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {plan.focus_areas?.length > 0 && (
        <div>
          <SectionTitle>Focus areas</SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {plan.focus_areas.map((a) => (
              <li key={a} className="rounded-[4px] bg-well px-2 py-0.5 text-xs text-ink-2">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SourceRefs({ refs }) {
  if (!refs?.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {refs.map((r) =>
        typeof r === 'number' ? (
          <span key={r} className="cite" aria-label={`Source ${r}`}>
            {r}
          </span>
        ) : (
          <span key={r} className="font-mono text-xs text-ink-3">
            {hostname(r) || r}
          </span>
        ),
      )}
    </span>
  );
}

function VerifierView({ details }) {
  const claims = details.verified_evidence || [];
  const unsupported = details.unsupported_claims || [];
  const verified = claims.filter((c) => c.is_verified).length;
  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {[
          ['Verified', verified, 'text-verified'],
          ['Not verified', claims.length - verified, 'text-ink-2'],
          ['Unsupported', unsupported.length, 'text-pencil'],
        ].map(([label, n, tone]) => (
          <div key={label}>
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className={`text-2xl font-semibold tabular-nums ${tone}`}>{n}</dd>
          </div>
        ))}
      </dl>
      {claims.length === 0 ? (
        <EmptyState icon={Inbox} title="No claims to check: the gatherers found no sources." />
      ) : (
        <div>
          <SectionTitle>Claims</SectionTitle>
          <ul className="divide-y divide-rule">
            {claims.map((c, i) => (
              <li key={i} className="flex gap-3 py-2.5 first:pt-0">
                {c.is_verified ? (
                  <CircleCheck aria-label="Verified" className="mt-0.5 h-4 w-4 shrink-0 text-verified" />
                ) : (
                  <CircleDashed aria-label="Not verified" className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {c.claim}
                    <SourceRefs refs={c.supporting_sources} />
                  </p>
                  {c.reasoning && <p className="text-xs text-ink-3">{c.reasoning}</p>}
                </div>
                <span className="shrink-0 font-mono text-xs text-ink-3 tabular-nums" title="Confidence">
                  {typeof c.confidence_score === 'number' ? `${Math.round(c.confidence_score * 100)}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {unsupported.length > 0 && (
        <div>
          <SectionTitle>Unsupported claims</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2 marker:text-pencil">
            {unsupported.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Body({ agentId, node }) {
  const d = node.details || {};
  switch (agentId) {
    case 'planner':
      return <PlanView plan={d.plan} />;
    case 'researcher':
      return <FindingList items={d.research_findings} emptyText="Search returned no web results." />;
    case 'news_agent':
      return <FindingList items={d.news_findings} emptyText="Search returned no news." />;
    case 'data_analyst':
      return <FindingList items={d.data_findings} emptyText="No figures were found in the search results." />;
    case 'verifier':
      return <VerifierView details={d} />;
    case 'writer':
      return d.draft_report ? (
        <div className="report report-compact">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.draft_report}</ReactMarkdown>
        </div>
      ) : null;
    case 'critic': {
      const approved = d.critic_decision !== 'REVISE';
      return (
        <div className="space-y-3">
          <Badge tone={approved ? 'verified' : 'pencil'} icon={approved ? CircleCheck : undefined}>
            {approved ? 'Approved' : 'Returned to the writer'}
          </Badge>
          {d.critic_feedback && <p className="text-sm whitespace-pre-wrap text-ink">{d.critic_feedback}</p>}
        </div>
      );
    }
    default:
      return null;
  }
}

/** One desk's output: who it is, how it went, which model answered, and what it produced. */
export function AgentOutput({ agentId, node, runFinished }) {
  const agent = AGENT_BY_ID[agentId];
  const index = AGENTS.indexOf(agent) + 1;
  const status = node?.status || 'waiting';
  const d = node?.details || {};

  return (
    <Panel aria-labelledby="desk-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">
            Desk {String(index).padStart(2, '0')} · {KIND_LABELS[agent.kind]}
          </p>
          <h2 id="desk-title" className="text-lg font-semibold text-ink">
            {agent.label}
          </h2>
          <p className="text-sm text-ink-3">{agent.role}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.model_used && (
            <span className="rounded-[4px] border border-rule px-1.5 py-0.5 font-mono text-xs text-ink-2">
              {shortModel(d.model_used)}
            </span>
          )}
          <StatusBadge status={status} label={!node && runFinished ? 'Not run' : undefined} />
        </div>
      </header>
      <div className="space-y-4 p-4">
        {!node || status === 'running' ? (
          status === 'running' ? (
            <Skeleton lines={4} />
          ) : (
            <EmptyState
              icon={CircleDashed}
              title={runFinished ? 'This desk did not run.' : 'This desk has not started yet.'}
            />
          )
        ) : (
          <>
            <ErrorNotice message={d.error} />
            {d.summary && <p className="text-sm text-ink-2">{d.summary}</p>}
            {(node.passes || 0) > 1 && agentId === 'writer' && (
              <p className="text-xs text-ink-3">Showing the latest of {node.passes} drafts.</p>
            )}
            <Body agentId={agentId} node={node} />
          </>
        )}
      </div>
    </Panel>
  );
}
