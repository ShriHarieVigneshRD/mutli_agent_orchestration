import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { ModelMap, ModelPicker } from './ModelPicker';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';

export const MIN_QUERY = 4;
export const MAX_QUERY = 2000;
const MAX_HEIGHT = 250;

/** The assignment slip: question, model choice, start. Ctrl/Cmd+Enter submits. */
export function Composer({ value, onChange, onSubmit, busy, modelSettings }) {
  const ref = useRef(null);
  const length = value.trim().length;
  const valid = length >= MIN_QUERY && length <= MAX_QUERY;

  const handleChange = (e) => {
    onChange(e.target.value);
    const el = e.target; // grow with the text, up to MAX_HEIGHT, then scroll
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = (e) => {
    e.preventDefault();
    if (valid && !busy) onSubmit();
  };

  return (
    <Panel as="form" onSubmit={submit} className="focus-within:border-rule-strong">
      <label htmlFor="query" className="sr-only">
        Research question
      </label>
      <textarea
        id="query"
        ref={ref}
        rows={3}
        value={value}
        maxLength={MAX_QUERY}
        onChange={handleChange}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit(e)}
        placeholder="e.g. How has rooftop solar changed household electricity bills in India since 2020?"
        aria-describedby="query-hint"
        className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 font-serif text-xl leading-snug text-ink placeholder:text-ink-4 focus:outline-none max-md:text-lg"
        style={{ maxHeight: MAX_HEIGHT }}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule px-4 py-3">
        <ModelPicker settings={modelSettings} disabled={busy} />
        <div className="ml-auto flex items-center gap-3">
          <span
            id="query-hint"
            className={`font-mono text-xs tabular-nums ${length > MAX_QUERY * 0.9 ? 'text-caution' : 'text-ink-4'}`}
          >
            <span className="sr-only">Characters used: </span>
            {length}/{MAX_QUERY}
          </span>
          <Button type="submit" variant="primary" disabled={!valid || busy}>
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            )}
            {busy ? 'Starting…' : 'Start research'}
          </Button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <ModelMap settings={modelSettings} />
      </div>
    </Panel>
  );
}
