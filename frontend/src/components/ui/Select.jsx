import { ChevronDown } from 'lucide-react';

/** Native <select> (keyboard, screen readers and mobile pickers for free), always labelled. */
export function Select({
  id,
  label,
  hideLabel = false,
  value,
  onChange,
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'shrink-0 text-xs font-medium text-ink-3'}>
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full min-w-0 appearance-none truncate rounded-control border border-rule-strong bg-well pr-8 pl-2.5 text-sm text-ink hover:border-ink-4 max-md:h-11 max-md:text-base"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-ink-3"
        />
      </div>
    </div>
  );
}
