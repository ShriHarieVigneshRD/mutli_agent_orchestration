import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import ReportChat from './ReportChat';

export default function ReportViewer({
  report,
  sources = [],
  criticFeedback = '',
  runId,
  onReportUpdated,
  onNewChatTrigger,
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'sources' | 'critic'
  const [localReportContent, setLocalReportContent] = useState(null);

  if (!report) return null;

  const currentMarkdown = localReportContent || (typeof report === 'string' ? report : report.full_markdown);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReportUpdatedFromChat = (updatedMarkdown) => {
    setLocalReportContent(updatedMarkdown);
    if (onReportUpdated) {
      onReportUpdated(updatedMarkdown);
    }
  };

  return (
    <div className="space-y-6">
      {/* REPORT VIEWER CARD */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Synthesized Research Report</h2>
              <p className="text-xs text-slate-400">Verified by Multi-Agent Graph & Critic Review</p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-950/80 p-1 border border-white/10 text-xs">
              <button
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'report'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="h-4 w-4" /> Full Report
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'sources'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="h-4 w-4" /> Sources ({sources.length})
              </button>
              {criticFeedback && (
                <button
                  onClick={() => setActiveTab('critic')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                    activeTab === 'critic'
                      ? 'bg-purple-500/20 text-purple-300 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" /> Critic Log
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all"
              >
                <Download className="h-4 w-4" /> Export MD
              </button>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-8 sm:p-10 overflow-y-auto max-h-[850px] bg-slate-950/40">
          {activeTab === 'report' && (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMarkdown}</ReactMarkdown>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white mb-4">Verified Sources & Citation Matrix</h3>
              {sources.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No web sources cited in this run.</p>
              ) : (
                sources.map((src, i) => (
                  <div key={i} className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" /> [{i + 1}] {src.title}
                      </span>
                      <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                        {src.source_type || 'web'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{src.snippet}</p>
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold mt-1"
                      >
                        {src.url} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic block mt-1">Source URL unavailable</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'critic' && (
            <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-base">
                <MessageSquare className="h-5 w-5" /> Critic Reflection & Review Feedback
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                {criticFeedback ||
                  report.critic_feedback ||
                  'Critic approved report without additional revision requirements.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* EMBEDDED REPORT FOLLOW-UP CHAT */}
      {runId && (
        <ReportChat
          runId={runId}
          onReportUpdated={handleReportUpdatedFromChat}
          onNewChatTrigger={onNewChatTrigger}
        />
      )}
    </div>
  );
}
