import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportChat from './ReportChat';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  getReportChat: vi.fn(),
  sendReportChatMessage: vi.fn(),
}));

describe('ReportChat', () => {
  beforeEach(() => {
    api.getReportChat.mockResolvedValue({
      messages: [{ id: 'm1', role: 'assistant', content: 'Earlier answer' }],
    });
  });

  it('loads previous messages', async () => {
    render(<ReportChat runId="r1" />);
    expect(await screen.findByText('Earlier answer')).toBeInTheDocument();
    expect(api.getReportChat).toHaveBeenCalledWith('r1');
  });

  it('sends a message and applies report edits', async () => {
    api.sendReportChatMessage.mockResolvedValue({
      chat_response: 'Updated the summary.',
      is_report_modified: true,
      updated_report_markdown: '# New report',
      version_count: 1,
    });
    const onReportUpdated = vi.fn();
    render(<ReportChat runId="r1" onReportUpdated={onReportUpdated} />);
    await screen.findByText('Earlier answer');

    const input = screen.getByPlaceholderText(/follow-up/i);
    fireEvent.change(input, { target: { value: 'Add risks' } });
    fireEvent.submit(input.closest('form'));

    expect(await screen.findByText('Updated the summary.')).toBeInTheDocument();
    expect(screen.getByText('Add risks')).toBeInTheDocument();
    expect(api.sendReportChatMessage).toHaveBeenCalledWith('r1', 'Add risks');
    await waitFor(() => expect(onReportUpdated).toHaveBeenCalledWith('# New report', 1));
    expect(screen.getByText(/Report updated/i)).toBeInTheDocument();
  });

  it('shows an error when the reply fails', async () => {
    api.sendReportChatMessage.mockRejectedValue(new Error('Rate limited'));
    render(<ReportChat runId="r1" />);
    const input = screen.getByPlaceholderText(/follow-up/i);
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('Rate limited')).toBeInTheDocument();
  });

  it('B26: keeps messages sent before the history finishes loading', async () => {
    let resolveHistory;
    api.getReportChat.mockReturnValue(new Promise((r) => (resolveHistory = r)));
    api.sendReportChatMessage.mockResolvedValue({ chat_response: 'Reply', is_report_modified: false });
    render(<ReportChat runId="r1" />);
    const input = screen.getByPlaceholderText(/follow-up/i);
    fireEvent.change(input, { target: { value: 'Early question' } });
    fireEvent.submit(input.closest('form'));
    resolveHistory({ messages: [] });
    await screen.findByText('Reply');
    expect(screen.getByText('Early question')).toBeInTheDocument();
  });
});
