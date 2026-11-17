import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime, shortModel } from '../lib/format';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';

const RUN_STATUS_LABEL = { completed: 'Done', running: 'Working', pending: 'Queued', failed: 'Failed' };

export function RunRow({ run, onDelete, compact = false }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-well/50">
      <Link to={`/runs/${run.id}`} className="min-w-0 flex-1 rounded-control">
        <p
          className={`text-sm font-medium text-ink [overflow-wrap:anywhere] ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}
        >
          {run.query}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          <time dateTime={run.created_at}>{formatDateTime(run.created_at)}</time>
          {!compact && run.provider && (
            <>
              {' · '}
              <span className="font-mono">{shortModel(run.provider)}</span>
            </>
          )}
        </p>
      </Link>
      <StatusBadge status={run.status} label={RUN_STATUS_LABEL[run.status]} />
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(run)}
          aria-label={`Delete run: ${run.query.slice(0, 80)}`}
          title="Delete run"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}
