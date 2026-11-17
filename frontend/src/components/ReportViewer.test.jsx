import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReportViewer from './ReportViewer';

const REPORT = { full_markdown: '# Solar Report\n\nBody text', critic_feedback: 'Good' };
const SOURCES = [{ title: 'Solar costs', url: 'https://example.org/solar', snippet: 'fell 40%', source_type: 'web' }];

describe('ReportViewer', () => {
  it('renders markdown, copies it and lists sources', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ReportViewer report={REPORT} sources={SOURCES} />);

    expect(screen.getByRole('heading', { name: 'Solar Report' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith(REPORT.full_markdown);

    fireEvent.click(screen.getByRole('button', { name: /Sources \(1\)/ }));
    expect(screen.getByRole('link', { name: /example\.org\/solar/ })).toHaveAttribute('href', 'https://example.org/solar');
  });

  it('exports the report as a markdown file', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ReportViewer report={REPORT} sources={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
