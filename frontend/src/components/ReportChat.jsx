import { FileCheck2, Loader2, MessageSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getReportChat, sendReportChatMessage } from '../lib/api';
import { shortModel } from '../lib/format';
import { Button } from './ui/Button';
import { Panel, PanelHeader } from './ui/Panel';
import { ErrorNotice } from './ui/States';

const PRESET_PROMPTS = [
  'Explain the final recommendation in simpler terms.',
  'Compare the key options in more detail.',
  'Modify the executive summary to highlight key risks.',
  'What are the biggest uncertainties in this report?',
  'Summarize this report into 5 bullet points for leadership.',
];

/** Follow-up questions about the report; the assistant can also rewrite the report on request.
 * Render with key={runId} so switching runs starts a fresh conversation. */
export default function ReportChat({ runId, onReportUpdated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [reportModified, setReportModified] = useState(false);
  const bottomRef = useRef(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    getReportChat(runId)
      .then((data) => {
        // Keep anything sent while the history was loading (B26).
        if (!cancelled) setMessages((prev) => [...(data.messages || []), ...prev]);
      })
      .catch((e) => !cancelled && setHistoryError(e.message));
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (messages.length) bottomRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages]);

  const localMessage = (role, content, extra) => ({
    id: `local-${nextId.current++}`,
    role,
    content,
    ...extra,
  });

  const handleSend = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setErrorMsg('');
    setReportModified(false);
    setMessages((prev) => [...prev, localMessage('user', text)]);
    setLoading(true);
    try {
      const res = await sendReportChatMessage(runId, text);
      setMessages((prev) => [
        ...prev,
        localMessage('assistant', res.chat_response, { model: res.model_used }),
      ]);
      if (res.is_report_modified && res.updated_report_markdown) {
        setReportModified(true);
        onReportUpdated?.(res.updated_report_markdown, res.version_count);
      }
    } catch (err) {
      setErrorMsg(err.message || 'The assistant could not answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel aria-labelledby="chat-title">
      <PanelHeader
        id="chat-title"
        title="Ask about this report"
        subtitle="Questions use the report and its sources. Ask for an edit and the report is rewritten."
      />

      {reportModified && (
        <p
          role="status"
          className="flex items-center gap-2 border-b border-rule bg-verified-soft px-4 py-2 text-sm text-ink"
        >
          <FileCheck2 aria-hidden className="h-4 w-4 text-verified" />
          Report updated. Use “Undo last edit” above to restore the previous version.
        </p>
      )}

      <div className="max-h-[28rem] min-h-40 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        <ErrorNotice message={historyError} />
        {messages.length === 0 && !historyError && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <MessageSquare aria-hidden className="h-5 w-5 text-ink-4" />
            <p className="text-sm text-ink-3">No questions yet. Try a suggestion below.</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-panel bg-well px-3 py-2 text-sm whitespace-pre-wrap text-ink">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <div className="report report-compact text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
              {m.model && <p className="mt-1 font-mono text-xs text-ink-4">{shortModel(m.model)}</p>}
            </div>
          ),
        )}
        {loading && (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Reading the report…
          </p>
        )}
        <ErrorNotice message={errorMsg} />
        <div ref={bottomRef} />
      </div>

      <div className="space-y-3 border-t border-rule px-4 py-3">
        <ul className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
          {PRESET_PROMPTS.map((p) => (
            <li key={p}>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSend(p)}
                className="rounded-control border border-rule px-2.5 py-1 text-left text-xs text-ink-2 transition-colors duration-150 hover:border-rule-strong hover:text-ink disabled:opacity-50 max-md:py-2"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            Follow-up question
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a follow-up question or request a report edit…"
            className="h-9 min-w-0 flex-1 rounded-control border border-rule-strong bg-well px-3 text-sm text-ink placeholder:text-ink-4 max-md:h-11 max-md:text-base"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            {loading ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Send aria-hidden className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Panel>
  );
}
