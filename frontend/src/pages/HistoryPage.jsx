import { History, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RunRow } from '../components/RunList';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Panel } from '../components/ui/Panel';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/States';
import { deleteResearchRun, getResearchHistory } from '../lib/api';

const PAGE = 20;

export default function HistoryPage() {
  const [runs, setRuns] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | more | error
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchPage = (offset) =>
    getResearchHistory({ limit: PAGE, offset }).then(
      (page) => {
        setRuns((prev) => (offset ? [...prev, ...page.runs] : page.runs));
        setTotal(page.total);
        setStatus('ready');
      },
      (e) => {
        setError(e.message);
        setStatus('error');
      },
    );

  const load = (offset = 0) => {
    setStatus(offset ? 'more' : 'loading');
    setError('');
    fetchPage(offset);
  };

  useEffect(() => {
    fetchPage(0);
  }, []);

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteResearchRun(toDelete.id);
      setRuns((prev) => prev.filter((r) => r.id !== toDelete.id));
      setTotal((t) => t - 1);
      setToDelete(null);
    } catch (e) {
      setDeleteError(e.message);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const needle = search.trim().toLowerCase();
  const visible = needle ? runs.filter((r) => r.query.toLowerCase().includes(needle)) : runs;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink max-md:text-2xl">
            History
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {status === 'loading' ? 'Loading…' : `${total} research run${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <label htmlFor="history-search" className="sr-only">
            Search loaded runs
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
          <input
            id="history-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="h-9 w-full rounded-control border border-rule-strong bg-well pr-3 pl-8 text-sm text-ink placeholder:text-ink-4 max-md:h-11 max-md:text-base"
          />
        </div>
      </div>

      <ErrorNotice className="mb-4" message={deleteError} />

      <Panel>
        {status === 'loading' ? (
          <Skeleton className="p-4" lines={6} />
        ) : status === 'error' && runs.length === 0 ? (
          <ErrorNotice className="m-3" message={error} onRetry={() => load()} />
        ) : runs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No research yet"
            action={
              <Button as={Link} to="/" variant="primary">
                Start your first run
              </Button>
            }
          >
            Every run you start is kept here with its report, sources and chat.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title={`Nothing matches “${search.trim()}”`}>
            Only the {runs.length} loaded runs are searched.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule">
            {visible.map((run) => (
              <RunRow key={run.id} run={run} onDelete={setToDelete} />
            ))}
          </ul>
        )}
      </Panel>

      {status === 'error' && runs.length > 0 && <ErrorNotice className="mt-4" message={error} />}
      {runs.length < total && status !== 'loading' && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => load(runs.length)} disabled={status === 'more'}>
            {status === 'more' ? 'Loading…' : `Load more (${total - runs.length} older)`}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this run?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete run'}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        <p className="line-clamp-3">“{toDelete?.query}”</p>
        <p className="mt-2">Its report, sources and chat are deleted too. This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  );
}
