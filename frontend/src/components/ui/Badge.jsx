import { CircleAlert, CircleCheck, CircleDashed, CircleX, CornerDownLeft, TriangleAlert } from 'lucide-react';

const TONES = {
  accent: 'text-accent bg-accent-soft',
  verified: 'text-verified bg-verified-soft',
  caution: 'text-caution bg-caution-soft',
  pencil: 'text-pencil bg-pencil-soft',
  muted: 'text-ink-3 bg-well',
};

const STATUS = {
  running: { label: 'Working', tone: 'accent' },
  pending: { label: 'Queued', tone: 'muted', icon: CircleDashed },
  waiting: { label: 'Waiting', tone: 'muted', icon: CircleDashed },
  completed: { label: 'Done', tone: 'verified', icon: CircleCheck },
  completed_with_no_results: { label: 'No results', tone: 'caution', icon: CircleAlert },
  degraded: { label: 'Fallback used', tone: 'caution', icon: TriangleAlert },
  failed: { label: 'Failed', tone: 'pencil', icon: CircleX },
  revise: { label: 'Returned', tone: 'pencil', icon: CornerDownLeft },
};

/** A stamp: colour + icon + word, never colour alone. */
export function Badge({ tone = 'muted', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon aria-hidden className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status = 'waiting', label, className }) {
  const s = STATUS[status] || STATUS.waiting;
  return (
    <Badge tone={s.tone} icon={s.icon} className={className}>
      {status === 'running' && <span aria-hidden className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />}
      {label || s.label}
    </Badge>
  );
}
