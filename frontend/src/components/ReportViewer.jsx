import { Check, Copy, Download, ExternalLink, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hostname, linkCitations } from '../lib/format';
import { Markdown } from './Markdown';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';
import { EmptyState } from './ui/States';
import { Tabs } from './ui/Tabs';

function slug(text = 'research-report') {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'research-report'
  );
}

export default function ReportViewer({ report, sources = [], onUndo, undoBusy = false }) {
  const [tab, setTab] = useState('report');
  const [copied, setCopied] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const copyTimer = useRef();
  const markdown = report?.full_markdown || '';

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (tab === 'sources' && highlight) {
      document.getElementById(`source-${highlight}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [tab, highlight]);

  if (!report) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const exportMarkdown = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(report.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cite = (n) => {
    setHighlight(n);
    setTab('sources');
  };

  const tabs = [
    { id: 'report', label: 'Report' },
    { id: 'sources', label: 'Sources', count: sources.length },
    { id: 'critic', label: 'Critic notes' },
  ];

  return (
    <Panel aria-label="Report">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <Tabs tabs={tabs} value={tab} onChange={setTab} idPrefix="report" label="Report views" />
        <div className="flex items-center gap-1">
          {report.version_count > 0 && onUndo && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              disabled={undoBusy}
              title="Restore the report as it was before the last chat edit"
            >
              <Undo2 aria-hidden className="h-3.5 w-3.5" /> Undo last edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy report as Markdown">
            {copied ? (
              <Check aria-hidden className="h-3.5 w-3.5 text-verified" />
            ) : (
              <Copy aria-hidden className="h-3.5 w-3.5" />
            )}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={exportMarkdown}
            aria-label="Export report as a Markdown file"
          >
            <Download aria-hidden className="h-3.5 w-3.5" /> Export .md
          </Button>
        </div>
      </div>

      <div
        id="report-panel"
        role="tabpanel"
        aria-labelledby={`report-tab-${tab}`}
        className="px-4 py-6 md:px-8 md:py-8"
      >
        {tab === 'report' && (
          <article className="report mx-auto">
            <Markdown
              components={{
                a: ({ href = '', children }) => {
                  const n = href.match(/^#source-(\d+)$/)?.[1];
                  if (!n) {
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a
                      href={href}
                      className="cite"
                      aria-label={`Source ${n}`}
                      onClick={(e) => {
                        e.preventDefault();
                        cite(Number(n));
                      }}
                    >
                      {n}
                    </a>
                  );
                },
              }}
            >
              {linkCitations(markdown)}
            </Markdown>
          </article>
        )}

        {tab === 'sources' &&
          (sources.length === 0 ? (
            <EmptyState title="No sources were saved for this run.">
              Search found nothing, so the report could not cite anything.
            </EmptyState>
          ) : (
            <ol className="mx-auto max-w-[68ch] divide-y divide-rule">
              {sources.map((s, i) => (
                <li
                  key={s.id || s.url}
                  id={`source-${i + 1}`}
                  className={`flex scroll-mt-24 gap-3 rounded-control py-3 transition-colors duration-500 ${
                    highlight === i + 1 ? 'bg-accent-soft px-2' : ''
                  }`}
                >
                  <span className="w-7 shrink-0 pt-0.5 font-mono text-xs text-ink-3 tabular-nums">
                    [{i + 1}]
                  </span>
                  <div className="min-w-0">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1 font-medium text-ink hover:text-accent"
                      >
                        <span className="[overflow-wrap:anywhere]">{s.title}</span>
                        <ExternalLink aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-4" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <p className="font-medium text-ink">{s.title}</p>
                    )}
                    <p className="text-xs text-ink-3">
                      {[hostname(s.url), s.source_type].filter(Boolean).join(' · ')}
                    </p>
                    {s.snippet && <p className="mt-1 line-clamp-3 text-sm text-ink-2">{s.snippet}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ))}

        {tab === 'critic' && (
          <p className="mx-auto max-w-[68ch] text-sm whitespace-pre-wrap text-ink">
            {report.critic_feedback || 'The critic left no notes.'}
          </p>
        )}
      </div>
    </Panel>
  );
}
