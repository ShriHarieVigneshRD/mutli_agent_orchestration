import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Sparkles, 
  PlusCircle, 
  FileEdit,
  AlertCircle 
} from 'lucide-react';
import { getReportChat, sendReportChatMessage } from '../services/api';

const PRESET_PROMPTS = [
  "Explain the final recommendation in simpler terms.",
  "Compare the key options in more detail.",
  "Modify the executive summary to highlight key risks.",
  "What are the biggest uncertainties in this report?",
  "Summarize this report into 5 bullet points for leadership."
];

export default function ReportChat({ runId, onReportUpdated, onNewChatTrigger }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [reportModifiedBanner, setReportModifiedBanner] = useState(false);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (!runId) return;
    fetchHistory();
  }, [runId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const data = await getReportChat(runId);
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSend = async (messageToSend) => {
    const text = messageToSend || input;
    if (!text || !text.trim() || loading) return;

    const userMsgText = text.trim();
    setInput('');
    setErrorMsg('');
    setReportModifiedBanner(false);

    // Optimistic UI update
    const tempUserMsg = { id: `temp-${Date.now()}`, role: 'user', content: userMsgText };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await sendReportChatMessage(runId, userMsgText);

      const assistantMsg = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.chat_response
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // If report was modified, trigger callback to update UI report view
      if (res.is_report_modified && res.updated_report_markdown) {
        setReportModifiedBanner(true);
        if (onReportUpdated) {
          onReportUpdated(res.updated_report_markdown);
        }
      }
    } catch (err) {
      console.error('Failed to send follow-up message:', err);
      setErrorMsg(err.message || 'Failed to generate follow-up response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col mt-8">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Report Follow-up & Interactive Editing
            </h3>
            <p className="text-xs text-slate-400">Ask clarifying questions or request report modifications</p>
          </div>
        </div>

        {onNewChatTrigger && (
          <button
            onClick={onNewChatTrigger}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-white/10 shadow-sm transition-all"
          >
            <PlusCircle className="h-4 w-4" /> New Research Query
          </button>
        )}
      </div>

      {/* REPORT MODIFIED NOTIFICATION BANNER */}
      {reportModifiedBanner && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 p-3 px-6 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
          <FileEdit className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Report updated successfully! The modified content has been applied to the view above.</span>
        </div>
      )}

      {/* CHAT MESSAGES CONTAINER */}
      <div className="p-6 sm:p-8 overflow-y-auto max-h-[500px] min-h-[250px] space-y-4 bg-slate-950/60">
        {messages.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <Sparkles className="h-8 w-8 text-purple-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Have questions about this research report?</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ask questions to clarify findings, request simplifications, or ask to modify specific sections of the report.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0 mt-1 shadow-md">
                  <Bot className="h-4.5 w-4.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-none shadow-lg'
                    : 'glass-panel bg-slate-900/90 text-slate-100 rounded-tl-none border border-white/10 shadow-md'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="markdown-content text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>

              {m.role === 'user' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-white shrink-0 mt-1 shadow-md">
                  <User className="h-4.5 w-4.5" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-3 justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0">
              <Bot className="h-4.5 w-4.5 animate-spin" />
            </div>
            <div className="glass-panel bg-slate-900/80 px-4 py-3 rounded-2xl border border-white/10 text-xs text-slate-300 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> Analyzing report context...
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* PRESET CHIPS & INPUT CONTAINER */}
      <div className="p-4 bg-slate-900/90 border-t border-white/10 space-y-3">
        {/* Preset Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Suggested:
          </span>
          {PRESET_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSend(promptText)}
              className="px-3 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs border border-white/10 transition-all text-left"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Form Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a follow-up question or request report edits..."
            className="flex-1 bg-slate-950 text-sm text-white placeholder-slate-500 px-4 py-3 rounded-2xl border border-white/15 focus:outline-none focus:border-purple-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-purple-500/20 transition-all shrink-0"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
