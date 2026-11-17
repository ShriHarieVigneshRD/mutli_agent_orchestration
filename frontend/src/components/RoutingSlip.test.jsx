import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RoutingSlip, WireLog } from './RoutingSlip';
import { ModelPicker } from './ModelPicker';

const CATALOGUE = {
  llm_configured: true,
  default_mode: 'per_agent',
  default_model: 'a/primary:free',
  options: ['a/primary:free', 'openrouter/free'],
  kinds: [
    { kind: 'supervisor', label: 'Supervisor', agents: ['planner'], model: 'a/primary:free' },
    { kind: 'specialist', label: 'Specialists', agents: ['data_analyst'], model: 'a/fast:free' },
    { kind: 'reviewer', label: 'Reviewers', agents: ['verifier', 'critic'], model: 'a/judge:free' },
    { kind: 'writer', label: 'Writers', agents: ['writer', 'chat'], model: 'a/writer:free' },
  ],
  fallbacks: ['a/judge:free', 'openrouter/free'],
};

const row = (name) => screen.getByRole('button', { name: new RegExp(`^\\d* ?${name}`) });

describe('RoutingSlip', () => {
  it('shows every desk plus the report, with status stamps', () => {
    render(
      <RoutingSlip
        nodes={{
          planner: { status: 'completed', details: { model_used: 'a/primary:free' } },
          researcher: { status: 'running' },
          news_agent: { status: 'completed_with_no_results', details: {} },
        }}
        selected="planner"
        onSelect={() => {}}
        runStatus="running"
        hasReport={false}
        modelSetting="per-agent"
        catalogue={CATALOGUE}
      />,
    );
    expect(screen.getAllByRole('listitem').filter((li) => li.querySelector('button'))).toHaveLength(8);
    expect(within(row('Planner')).getByText('Done')).toBeInTheDocument();
    expect(within(row('Researcher')).getByText('Working')).toBeInTheDocument();
    expect(within(row('News agent')).getByText('No results')).toBeInTheDocument();
    expect(within(row('Writer')).getByText('Waiting')).toBeInTheDocument();
    expect(row('Planner')).toHaveAttribute('aria-current', 'true');
  });

  it('marks answers from a fallback tier and the critic sending the draft back', () => {
    render(
      <RoutingSlip
        nodes={{
          planner: { status: 'completed', details: { model_used: 'openrouter/free' } },
          writer: { status: 'completed', details: {}, passes: 2 },
        }}
        selected="report"
        onSelect={() => {}}
        runStatus="completed"
        hasReport
        modelSetting="per-agent"
        catalogue={CATALOGUE}
      />,
    );
    expect(within(row('Planner')).getByText('(fallback)')).toBeInTheDocument();
    expect(screen.getByText(/Returned to the writer 1×/)).toBeInTheDocument();
    expect(within(row('Verifier')).getByText('Not run')).toBeInTheDocument();
  });

  it('selects a desk', () => {
    const onSelect = vi.fn();
    render(
      <RoutingSlip nodes={{}} selected="report" onSelect={onSelect} runStatus="running" hasReport={false} />,
    );
    fireEvent.click(row('Verifier'));
    expect(onSelect).toHaveBeenCalledWith('verifier');
  });

  it('lists live events in the log', () => {
    render(
      <WireLog events={[{ event: 'data_analyst_completed', at: '2026-01-01T10:00:00Z' }]} finished={false} />,
    );
    expect(screen.getByText('Data analyst completed')).toBeInTheDocument();
  });
});

describe('ModelPicker', () => {
  it('shows the model dropdown only in single-model mode', () => {
    const update = vi.fn();
    const settings = { catalogue: CATALOGUE, mode: 'per_agent', model: 'a/primary:free', update };
    const { rerender } = render(<ModelPicker settings={settings} />);
    expect(screen.queryByLabelText('Model for all agents')).toBeNull();

    fireEvent.change(screen.getByLabelText('Models'), { target: { value: 'single' } });
    expect(update).toHaveBeenCalledWith({ mode: 'single' });

    rerender(<ModelPicker settings={{ ...settings, mode: 'single' }} />);
    const select = screen.getByLabelText('Model for all agents');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['primary', 'OpenRouter auto']);
    fireEvent.change(select, { target: { value: 'openrouter/free' } });
    expect(update).toHaveBeenCalledWith({ model: 'openrouter/free' });
  });
});
