import { ArrowUpRight, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Composer } from '../components/Composer';
import { RunRow } from '../components/RunList';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/States';
import { createResearchRun, getResearchHistory } from '../lib/api';

const EXAMPLE_PROMPTS = [
  'Analyze how AI coding agents may impact junior software engineering jobs over the next 3–5 years.',
  'Evaluate the market potential and technical hurdles of Quantum Computing in Cryptography.',
  'Investigate current 2025/2026 trends in Autonomous Vehicle Regulation & AI Safety Standards.',
];

function RecentRuns() {
  const [state, setState] = useState({ runs: null, error: '' });

  const fetchRuns = () =>
    getResearchHistory({ limit: 5 })
      .then((data) => setState({ runs: data.runs, error: '' }))
      .catch((e) => setState({ runs: [], error: e.message }));

  useEffect(() => {
    fetchRuns();
  }, []);

  const retry = () => {
    setState({ runs: null, error: '' });
    fetchRuns();
  };

  return (
    <Panel aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        title="Recent runs"
        actions={
          <Link to="/history" className="text-xs text-accent hover:underline">
            All history
          </Link>
        }
      />
      {state.runs === null ? (
        <Skeleton className="p-4" lines={4} />
      ) : state.error ? (
        <ErrorNotice className="m-3" message={state.error} onRetry={retry} />
      ) : state.runs.length === 0 ? (
        <EmptyState title="No runs yet">Your research appears here.</EmptyState>
      ) : (
        <ul className="divide-y divide-rule">
          {state.runs.map((run) => (
            <RunRow key={run.id} run={run} compact />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function WorkspacePage({ modelSettings, offline }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const { mode, model } = modelSettings;
      const res = await createResearchRun(query.trim(), { mode, model });
      navigate(`/runs/${res.run_id}`);
    } catch (e) {
      setError(e.message || 'Could not start the research run.');
      setBusy(false);
    }
  };

  const pickExample = (prompt) => {
    setQuery(prompt);
    document.getElementById('query')?.focus();
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 md:px-6 md:py-12 xl:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <section aria-labelledby="ws-title" className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">New assignment</p>
          <h1
            id="ws-title"
            className="mt-1 font-serif text-3xl font-semibold tracking-tight text-ink max-md:text-2xl"
          >
            What should the desk look into?
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-2">
            Seven agents plan the work, search the web and the news, pull out figures, check the claims and
            write a cited brief. You can watch every desk as it works.
          </p>

          {offline && (
            <p className="mt-4 flex max-w-2xl items-start gap-2 rounded-panel bg-caution-soft px-3 py-2 text-sm text-ink">
              <WifiOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
              Offline demo mode: no OpenRouter key is configured, so reports are assembled from real search
              results without AI analysis.
            </p>
          )}

          <div className="mt-6">
            <Composer
              value={query}
              onChange={setQuery}
              onSubmit={start}
              busy={busy}
              modelSettings={modelSettings}
            />
          </div>
          <ErrorNotice className="mt-4" message={error} />

          <div className="mt-10">
            <h2 className="text-xs font-medium tracking-wide text-ink-3 uppercase">
              Or start from an example
            </h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => pickExample(prompt)}
                    className="group flex w-full items-start justify-between gap-3 py-3 text-left text-sm text-ink-2 transition-colors duration-150 hover:text-ink"
                  >
                    {prompt}
                    <ArrowUpRight
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-4 group-hover:text-accent"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="min-w-0">
          <RecentRuns />
        </aside>
      </div>
    </div>
  );
}
