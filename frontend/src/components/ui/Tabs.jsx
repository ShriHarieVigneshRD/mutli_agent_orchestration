import { useRef } from 'react';

/**
 * Tab list with arrow-key navigation (WAI-ARIA tabs pattern). The parent renders the panel with
 * id `${idPrefix}-panel` and aria-labelledby `${idPrefix}-tab-${value}`.
 */
export function Tabs({ tabs, value, onChange, idPrefix, label, className = '' }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.id === value);
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next;
    if (delta) next = tabs[(i + delta + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={`flex gap-1 ${className}`}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => (refs.current[tab.id] = el)}
            id={`${idPrefix}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-sm whitespace-nowrap transition-colors duration-150 max-md:h-10 ${
              selected ? 'bg-well font-medium text-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="font-mono text-xs text-ink-3 tabular-nums">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
