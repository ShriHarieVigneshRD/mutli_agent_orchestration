import { shortModel } from '../lib/format';
import { Select } from './ui/Select';

/**
 * Two modes: every kind of agent on its own model (per-agent), or one model for all agents.
 * `settings` comes from useModelSettings().
 */
export function ModelPicker({ settings, disabled }) {
  const { catalogue, mode, model, update } = settings;
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">Models</legend>
      <Select id="model-mode" label="Models" value={mode} onChange={(v) => update({ mode: v })}>
        <option value="per_agent">Per-agent (4 kinds)</option>
        <option value="single">One model for all</option>
      </Select>
      {mode === 'single' && (
        <Select
          id="model-single"
          label="Model for all agents"
          hideLabel
          value={model || ''}
          onChange={(v) => update({ model: v })}
          disabled={!catalogue}
        >
          {(catalogue?.options || []).map((id) => (
            <option key={id} value={id}>
              {shortModel(id)}
            </option>
          ))}
        </Select>
      )}
    </fieldset>
  );
}

/** Which model each kind of agent uses, and the shared fallback tiers. */
export function ModelMap({ settings }) {
  const { catalogue, mode, model } = settings;
  if (!catalogue) return null;
  return (
    <details className="group text-xs text-ink-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-control py-1 hover:text-ink">
        <span className="underline decoration-rule-strong underline-offset-4">Model map</span>
        <span aria-hidden className="transition-transform duration-150 group-open:rotate-90">
          ›
        </span>
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-control bg-well p-3">
        {catalogue.kinds.map((k) => (
          <div key={k.kind} className="contents">
            <dt className="text-ink-2">
              {k.label} <span className="text-ink-4">({k.agents.join(', ').replaceAll('_', ' ')})</span>
            </dt>
            <dd className="truncate font-mono text-ink">{shortModel(mode === 'single' ? model : k.model)}</dd>
          </div>
        ))}
        <dt className="text-ink-2">Then, if a model fails</dt>
        <dd className="font-mono text-ink">{catalogue.fallbacks.map(shortModel).join(' → ')}</dd>
      </dl>
    </details>
  );
}
