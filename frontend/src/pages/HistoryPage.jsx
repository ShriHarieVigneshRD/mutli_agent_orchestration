import React, { useEffect, useState } from 'react';
import { getResearchHistory, getResearchRun } from '../lib/api';
import { History, FileText, CheckCircle2, AlertTriangle, Clock, Search, Bot } from 'lucide-react';
import AgentInspector from '../components/AgentInspector';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [agentLogs, setAgentLogs] = useState({});
  const [selectedReport, setSelectedReport] = useState(null);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getResearchHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = async (runId) => {
    try {
      const data = await getResearchRun(runId);
      setSelectedRun(data);
      if (data.report) {
        setSelectedReport(data.report);
      } else {
        setSelectedReport(null);
      }
      setSources(data.sources || []);

      if (data.logs) {
        const map = {};
        data.logs.forEach((l) => {
          if (l.details) map[l.agent_name] = l.details;
        });
        setAgentLogs(map);
      }
    } catch (err) {
      console.error('Error fetching run details:', err);
    }
  };

  const filteredHistory = history.filter((h) => h.query.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-[1700px] px-6 sm:px-10 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <History className="h-8 w-8 text-purple-400" /> Research History & Multi-Agent Archive
          </h1>
          <p className="text-base text-slate-300">
            View, inspect, and audit past multi-agent execution outputs
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search past research queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl bg-slate-900/90 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 border border-white/15 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ChatGPT Style Runs Sidebar */}
        <div className="lg:col-span-1 glass-panel rounded-3xl p-6 border border-white/10 space-y-4 max-h-[800px] overflow-y-auto shadow-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">
            Past Research Runs ({filteredHistory.length})
          </h3>

          {loading ? (
            <p className="text-sm text-slate-400 italic p-4 text-center">Loading research history...</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-slate-400 italic p-4 text-center">No research runs recorded yet.</p>
          ) : (
            filteredHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectRun(item.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedRun?.id === item.id
                    ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                    {item.provider}
                  </span>
                  {item.status === 'completed' ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" /> Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                      <Clock className="h-3.5 w-3.5 animate-spin" /> {item.status}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-relaxed">
                  {item.query}
                </p>
                <span className="text-xs text-slate-400 block mt-2 font-mono">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Selected Run Agent Inspector */}
        <div className="lg:col-span-2">
          {selectedRun ? (
            <AgentInspector
              query={selectedRun.query}
              status={selectedRun.status}
              completedNodes={[
                'planner',
                'researcher',
                'data_analyst',
                'news_agent',
                'verifier',
                'writer',
                'critic',
              ]}
              agentLogs={agentLogs}
              sources={sources}
              report={selectedReport}
              criticFeedback={selectedReport?.critic_feedback || ''}
              revisionCount={selectedRun.revision_count || 0}
              runId={selectedRun.id}
              onReportUpdated={(updatedMd) =>
                setSelectedReport((prev) => ({ ...(prev || {}), full_markdown: updatedMd }))
              }
            />
          ) : (
            <div className="glass-panel rounded-3xl p-16 border border-white/10 text-center space-y-4">
              <Bot className="h-14 w-14 text-cyan-400/80 mx-auto" />
              <h3 className="text-lg font-bold text-white">Select a research run to inspect agent outputs</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Inspect past multi-agent execution steps, task planning, verified sources, and critic
                reflection logs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
