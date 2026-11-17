import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  createResearchRun: vi.fn(),
  getResearchRun: vi.fn(),
  subscribeToRunEvents: vi.fn(),
  getReportChat: vi.fn(),
  sendReportChatMessage: vi.fn(),
}));

const RUN = {
  id: 'r1',
  query: 'Solar costs',
  status: 'completed',
  sources: [
    { title: 'Solar costs', url: 'https://example.org/solar', snippet: 'fell 40%', source_type: 'web' },
  ],
  logs: [
    {
      agent_name: 'planner',
      details: { plan: { tasks: ['Find cost data'], agents_required: [], focus_areas: [] } },
    },
  ],
  report: { id: 'rep1', full_markdown: '# Solar Report\n\nBody', critic_feedback: 'Good' },
};

describe('Dashboard research flow', () => {
  let emit;

  beforeEach(() => {
    api.createResearchRun.mockResolvedValue({ run_id: 'r1', status: 'pending' });
    api.getResearchRun.mockResolvedValue(RUN);
    api.getReportChat.mockResolvedValue({ messages: [] });
    api.subscribeToRunEvents.mockImplementation((_id, onEvent) => {
      emit = onEvent;
      return () => {};
    });
  });

  it('starts a run, follows live events and shows the final report', async () => {
    render(
      <MemoryRouter>
        <Dashboard currentProvider="openrouter/free" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Solar costs' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));

    await waitFor(() => expect(api.createResearchRun).toHaveBeenCalledWith('Solar costs', 'openrouter/free'));
    await waitFor(() => expect(api.subscribeToRunEvents).toHaveBeenCalled());

    act(() =>
      emit({ event: 'planner_completed', data: { details: { plan: { tasks: ['Find cost data'] } } } }),
    );
    act(() => emit({ event: 'research_completed', data: { status: 'completed' } }));
    await waitFor(() => expect(api.getResearchRun).toHaveBeenCalledWith('r1'));

    fireEvent.click(screen.getAllByRole('button', { name: /Final Report/ })[0]);
    expect(await screen.findByRole('heading', { name: 'Solar Report' })).toBeInTheDocument();
  });

  it('shows an error when the run cannot start', async () => {
    api.createResearchRun.mockRejectedValue(new Error('Server down'));
    render(
      <MemoryRouter>
        <Dashboard currentProvider="openrouter/free" />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Solar costs' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    expect(await screen.findByText('Server down')).toBeInTheDocument();
  });

  it('example prompts fill the prompt box', () => {
    render(
      <MemoryRouter>
        <Dashboard currentProvider="openrouter/free" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Quantum Computing/ }));
    expect(screen.getByRole('textbox').value).toMatch(/Quantum Computing/);
  });
});
