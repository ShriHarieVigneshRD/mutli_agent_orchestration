import { CircleX, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-2 px-6 py-10 text-center ${className}`}>
      {Icon && <Icon aria-hidden className="mb-1 h-6 w-6 text-ink-4" />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ message, onRetry, className = '' }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start gap-3 rounded-panel border border-pencil/30 bg-pencil-soft px-4 py-3 text-sm text-ink ${className}`}
    >
      <CircleX aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-pencil" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}
