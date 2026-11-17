import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import * as api from '../lib/api';
import HistoryPage from './HistoryPage';
import RunRoute from './RunPage';
import WorkspacePage from './WorkspacePage';
import { ThemeToggle } from '../components/AppHeader';

vi.mock('../lib/api', () => ({
  createResearchRun: vi.fn(),
  getResearchRun: vi.fn(),
  getResearchHistory: vi.fn(),
  deleteResearchRun: vi.fn(),
  revertReport: vi.fn(),
  subscribeToRunEvents: vi.fn(),
  getReportChat: vi.fn(),
  sendReportChatMessage: vi.fn(),
}));

const SETTINGS = {
  catalogue: { options: ['a/m:free'], kinds: [], fallbacks: [], default_model: 'a/m:free' },
  mode: 'per_agent',
  model: 'a/m:free',
  update: vi.fn(),
};

function Where() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

const RUN = {
  id: 'r1',
  query: 'Solar costs in India',
  provider: 'per-agent',
  status: 'running',
  created_at: '2026-11-17T15:00:00Z',
  revision_count: 0,
  sources: [],
  logs: [],
  report: null,
};
const DONE = {
  ...RUN,
  status: 'completed',
  sources: [{ id: 's1', title: 'Solar costs', url: 'https://example.org/solar', source_type: 'web' }],
  logs: [{ agent_name: 'planner', status: 'completed', details: { plan: { tasks: ['Find costs'] } } }],
  report: { id: 'rep', title: 'Solar', full_markdown: '# Solar\n\nCosts fell [1].', version_count: 1 },
};

beforeEach(() => {
  api.getResearchHistory.mockResolvedValue({ runs: [], total: 0 });
  api.getReportChat.mockResolvedValue({ messages: [] });
});

describe('WorkspacePage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WorkspacePage modelSettings={SETTINGS} />} />
          <Route path="/runs/:runId" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

  it('starts a run with the chosen models and opens it', async () => {
    api.createResearchRun.mockResolvedValue({ run_id: 'r9' });
    renderPage();
    fireEvent.change(screen.getByLabelText('Research question'), { target: { value: 'Solar costs' } });
    fireEvent.click(screen.getByRole('button', { name: /Start research/ }));
    expect(await screen.findByTestId('path')).toHaveTextContent('/runs/r9');
    expect(api.createResearchRun).toHaveBeenCalledWith('Solar costs', {
      mode: 'per_agent',
      model: 'a/m:free',
    });
  });

  it('keeps short questions from being sent', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Research question'), { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: /Start research/ })).toBeDisabled();
  });

  it('shows why a run could not start', async () => {
    api.createResearchRun.mockRejectedValue(new Error('Too many research runs this hour.'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Research question'), { target: { value: 'Solar costs' } });
    fireEvent.click(screen.getByRole('button', { name: /Start research/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many research runs this hour.');
  });

  it('example prompts fill the question box', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Quantum Computing/ }));
    expect(screen.getByLabelText('Research question').value).toMatch(/Quantum Computing/);
  });

  it('lists recent runs', async () => {
    api.getResearchHistory.mockResolvedValue({ runs: [DONE], total: 1 });
    renderPage();
    expect(await screen.findByRole('link', { name: /Solar costs in India/ })).toHaveAttribute(
      'href',
      '/runs/r1',
    );
  });
});

describe('RunPage', () => {
  let stream;

  beforeEach(() => {
    api.subscribeToRunEvents.mockImplementation((_id, handlers) => {
      stream = handlers;
      return vi.fn();
    });
  });

  const renderRun = () =>
    render(
      <MemoryRouter initialEntries={['/runs/r1']}>
        <Routes>
          <Route path="/runs/:runId" element={<RunRoute catalogue={null} />} />
        </Routes>
      </MemoryRouter>,
    );

  it('follows a live run and shows the report when it finishes', async () => {
    api.getResearchRun.mockResolvedValueOnce(RUN).mockResolvedValue(DONE);
    renderRun();
    expect(await screen.findByRole('heading', { name: 'Solar costs in India' })).toBeInTheDocument();
    await waitFor(() => expect(api.subscribeToRunEvents).toHaveBeenCalled());
    expect(screen.getByText('Live')).toBeInTheDocument();

    act(() => stream.onReset());
    act(() => stream.onEvent({ event: 'planner_started', at: '2026-11-17T15:00:00Z' }));
    const planner = screen.getByRole('button', { name: /Planner/ });
    expect(within(planner).getByText('Working')).toBeInTheDocument();

    act(() =>
      stream.onEvent({
        event: 'planner_completed',
        at: '2026-11-17T15:00:02Z',
        data: { details: { status: 'completed', plan: { tasks: ['Find costs'] } } },
      }),
    );
    expect(within(planner).getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Find costs')).toBeInTheDocument(); // main column follows the active desk

    act(() => stream.onEvent({ event: 'research_completed', data: {} }));
    expect(await screen.findByText('Finished')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Solar' })).toBeInTheDocument();
  });

  it('opens a finished run without streaming and can undo a chat edit', async () => {
    api.getResearchRun.mockResolvedValue(DONE);
    api.revertReport.mockResolvedValue({ full_markdown: '# Original\n\nText.', version_count: 0 });
    renderRun();
    expect(await screen.findByRole('heading', { name: 'Solar' })).toBeInTheDocument();
    expect(api.subscribeToRunEvents).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Undo last edit/ }));
    expect(await screen.findByRole('heading', { name: 'Original' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo last edit/ })).toBeNull();
  });

  it('shows a failed run honestly', async () => {
    api.getResearchRun.mockResolvedValue({ ...RUN, status: 'failed', error_message: 'Daily limit reached.' });
    renderRun();
    expect((await screen.findAllByText(/Daily limit reached/)).length).toBeGreaterThan(0);
    expect(screen.getByText('No report was written.')).toBeInTheDocument();
  });

  it('offers a retry when the run cannot be loaded', async () => {
    api.getResearchRun.mockRejectedValueOnce(new Error('Research run not found'));
    renderRun();
    expect(await screen.findByRole('alert')).toHaveTextContent('Research run not found');
  });
});

describe('HistoryPage', () => {
  const OTHER = { ...DONE, id: 'r2', query: 'Wind power in Europe' };

  const renderHistory = () =>
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

  it('searches loaded runs', async () => {
    api.getResearchHistory.mockResolvedValue({ runs: [DONE, OTHER], total: 2 });
    renderHistory();
    expect(await screen.findByText('2 research runs')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search loaded runs'), { target: { value: 'wind' } });
    expect(screen.queryByText('Solar costs in India')).toBeNull();
    expect(screen.getByText('Wind power in Europe')).toBeInTheDocument();
  });

  it('deletes a run after confirmation', async () => {
    api.getResearchHistory.mockResolvedValue({ runs: [DONE, OTHER], total: 2 });
    api.deleteResearchRun.mockResolvedValue({});
    renderHistory();
    fireEvent.click(await screen.findByRole('button', { name: /Delete run: Solar costs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    await waitFor(() => expect(screen.queryByText('Solar costs in India')).toBeNull());
    expect(api.deleteResearchRun).toHaveBeenCalledWith('r1');
    expect(screen.getByText('1 research run')).toBeInTheDocument();
  });

  it('loads older runs', async () => {
    api.getResearchHistory
      .mockResolvedValueOnce({ runs: [DONE], total: 2 })
      .mockResolvedValueOnce({ runs: [OTHER], total: 2 });
    renderHistory();
    fireEvent.click(await screen.findByRole('button', { name: /Load more/ }));
    expect(await screen.findByText('Wind power in Europe')).toBeInTheDocument();
    expect(api.getResearchHistory).toHaveBeenLastCalledWith({ limit: 20, offset: 1 });
  });

  it('shows an error with retry instead of an empty list', async () => {
    api.getResearchHistory.mockRejectedValueOnce(new Error('Cannot reach the research server.'));
    renderHistory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the research server.');
    expect(screen.queryByText('No research yet')).toBeNull();
  });
});

describe('ThemeToggle', () => {
  it('switches theme and remembers it', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
  });
});
