import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReportViewer from './ReportViewer';

const REPORT = {
  title: 'Solar Report',
  full_markdown: '# Solar Report\n\nCosts fell 40% [1].',
  critic_feedback: 'Good',
  version_count: 0,
};
const SOURCES = [
  {
    id: 's1',
    title: 'Solar costs',
    url: 'https://example.org/solar',
    snippet: 'fell 40%',
    source_type: 'web',
  },
];

describe('ReportViewer', () => {
  it('renders the report, copies it and lists sources', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ReportViewer report={REPORT} sources={SOURCES} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Solar Report' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Copy report/ }));
    expect(writeText).toHaveBeenCalledWith(REPORT.full_markdown);
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Sources/ }));
    expect(screen.getByRole('link', { name: /Solar costs/ })).toHaveAttribute(
      'href',
      'https://example.org/solar',
    );
  });

  it('turns citations into links that open the matching source', () => {
    render(<ReportViewer report={REPORT} sources={SOURCES} />);
    fireEvent.click(screen.getByRole('link', { name: 'Source 1' }));
    expect(screen.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('source-1')).toHaveClass('bg-accent-soft');
  });

  it('exports the report as a markdown file named after the title', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    let downloaded;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      downloaded = this.download;
    });
    render(<ReportViewer report={REPORT} sources={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(downloaded).toBe('solar-report.md');
    vi.unstubAllGlobals();
  });

  it('offers undo only when an earlier version exists', () => {
    const onUndo = vi.fn();
    const { rerender } = render(<ReportViewer report={REPORT} sources={[]} onUndo={onUndo} />);
    expect(screen.queryByRole('button', { name: /Undo last edit/ })).toBeNull();
    rerender(<ReportViewer report={{ ...REPORT, version_count: 2 }} sources={[]} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole('button', { name: /Undo last edit/ }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('switches tabs with the arrow keys', () => {
    render(<ReportViewer report={REPORT} sources={SOURCES} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Report' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Sources/ }), { key: 'End' });
    expect(screen.getByText('Good')).toBeInTheDocument();
  });
});
