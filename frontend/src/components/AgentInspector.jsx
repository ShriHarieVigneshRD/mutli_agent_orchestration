import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BrainCircuit,
  Globe,
  BarChart3,
  Newspaper,
  ShieldCheck,
  PenTool,
  Eye,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import ReportViewer from './ReportViewer';

export default function AgentInspector({
  query,
  status,
  completedNodes = [],
  agentLogs = {},
  sources = [],
  report = null,
  criticFeedback = '',
  revisionCount = 0,
  runId,
  onReportUpdated,
  onNewChatTrigger,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview & Flow', icon: Layers },
    { id: 'planner', label: 'Planner', icon: BrainCircuit },
    { id: 'researcher', label: 'Researcher', icon: Globe },
    { id: 'data_analyst', label: 'Data Analyst', icon: BarChart3 },
    { id: 'news_agent', label: 'News Agent', icon: Newspaper },
    { id: 'verifier', label: 'Verifier', icon: ShieldCheck },
    { id: 'writer', label: 'Writer', icon: PenTool },
    { id: 'critic', label: 'Critic', icon: Eye },
    { id: 'report', label: 'Final Report', icon: FileText },
  ];

  // Helper getters for node data & structured agent_outputs
  const plannerData = agentLogs.planner?.plan || null;
  const researcherData = agentLogs.researcher?.research_findings || [];
  const researcherStatus =
    agentLogs.researcher?.agent_outputs?.researcher?.status ||
    (completedNodes.includes('researcher') ? 'completed' : 'waiting');
  const researcherError = agentLogs.researcher?.agent_outputs?.researcher?.error;

  const dataAnalystData = agentLogs.data_analyst?.data_findings || [];
  const dataAnalystStatus =
    agentLogs.data_analyst?.agent_outputs?.data_analyst?.status ||
    (completedNodes.includes('data_analyst') ? 'completed' : 'waiting');
  const dataAnalystError = agentLogs.data_analyst?.agent_outputs?.data_analyst?.error;

  const newsData = agentLogs.news_agent?.news_findings || [];
  const newsStatus =
    agentLogs.news_agent?.agent_outputs?.news_agent?.status ||
    (completedNodes.includes('news_agent') ? 'completed' : 'waiting');
  const newsError = agentLogs.news_agent?.agent_outputs?.news_agent?.error;

  const verifierEvidence = agentLogs.verifier?.verified_evidence || [];
  const unsupportedClaims = agentLogs.verifier?.unsupported_claims || [];
  const writerDraft = agentLogs.writer?.draft_report || '';
  const criticDecision = agentLogs.critic?.critic_decision || (report ? 'APPROVE' : '');
  const criticMsg = agentLogs.critic?.critic_feedback || criticFeedback || '';

  const renderStatusBadge = (nodeStatus) => {
    if (nodeStatus === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-full border border-rose-500/40">
          <XCircle className="h-3.5 w-3.5" /> ✗ Failed
        </span>
      );
    }
    if (nodeStatus === 'completed_with_no_results') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-500/40">
          <AlertCircle className="h-3.5 w-3.5" /> ✓ Completed – No Results Found
        </span>
      );
    }
    if (nodeStatus === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40">
          <CheckCircle2 className="h-3.5 w-3.5" /> ✓ Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-full border border-white/10">
        <Clock className="h-3.5 w-3.5 text-slate-500" /> Waiting / Pending
      </span>
    );
  };

  return (
    <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
      {/* INSPECTION TAB HEADER BAR */}
      <div className="bg-slate-900/90 border-b border-white/10 px-6 py-3.5 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDone = completedNodes.includes(tab.id) || (tab.id === 'report' && report);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {isDone && tab.id !== 'overview' && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* INSPECTION CONTENT AREA */}
      <div className="p-6 sm:p-10 max-h-[850px] overflow-y-auto bg-slate-950/50">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Multi-Agent Execution Pipeline Overview</h3>
              <p className="text-sm text-slate-300">
                Research Question: <span className="font-semibold text-cyan-300">{query}</span>
              </p>
            </div>

            {/* Stage Progress Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: '1. Supervisor Planner', id: 'planner', desc: 'Decomposes prompt into tasks' },
                { name: '2. Parallel Researcher', id: 'researcher', desc: 'Broad web search & evidence' },
                { name: '3. Data Analyst', id: 'data_analyst', desc: 'Quantitative metrics & statistics' },
                { name: '4. News Agent', id: 'news_agent', desc: '2025/2026 developments' },
                { name: '5. Verifier Agent', id: 'verifier', desc: 'Claims & evidence verification' },
                { name: '6. Writer Agent', id: 'writer', desc: 'Report synthesis' },
                { name: '7. Critic Agent', id: 'critic', desc: 'Quality review & reflection' },
                { name: '8. Final Report', id: 'report', desc: 'Publication markdown output' },
              ].map((stage) => {
                const isCompleted = completedNodes.includes(stage.id) || (stage.id === 'report' && report);

                return (
                  <div
                    key={stage.id}
                    onClick={() => setActiveTab(stage.id)}
                    className={`cursor-pointer p-4.5 rounded-2xl border transition-all ${
                      isCompleted
                        ? 'bg-slate-900/80 border-emerald-500/40 hover:border-emerald-400'
                        : 'bg-slate-900/30 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {stage.name}
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{stage.desc}</p>
                    <span className="text-[11px] text-cyan-400 font-semibold inline-flex items-center gap-1 mt-3">
                      Inspect Output <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PLANNER TAB */}
        {activeTab === 'planner' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <BrainCircuit className="h-6 w-6 text-amber-400" /> Supervisor Planner Output
                </h3>
                <p className="text-sm text-slate-300">Structured prompt decomposition & task routing plan</p>
              </div>
            </div>

            {plannerData ? (
              <div className="space-y-6">
                <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                    Research Tasks Generated
                  </h4>
                  <ul className="space-y-2">
                    {plannerData.tasks?.map((task, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-200 flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-white/5"
                      >
                        <span className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                    <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                      Assigned Agents
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {plannerData.agents_required?.map((agent, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                    <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                      Focus Areas
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {plannerData.focus_areas?.map((area, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Planner output not available yet.</p>
            )}
          </div>
        )}

        {/* RESEARCHER TAB */}
        {activeTab === 'researcher' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Globe className="h-6 w-6 text-cyan-400" /> Web Research Agent Output
                </h3>
                <p className="text-sm text-slate-300">
                  Gathered web findings with verified original source URLs
                </p>
              </div>
              {renderStatusBadge(researcherStatus)}
            </div>

            {researcherError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                Error: {researcherError}
              </div>
            )}

            {researcherData.length === 0 ? (
              <div className="p-6 text-center glass-panel rounded-2xl border border-white/10 space-y-2">
                <p className="text-sm font-semibold text-slate-300">
                  {researcherStatus === 'completed_with_no_results'
                    ? '✓ Completed – No relevant web research findings were identified.'
                    : 'No web research findings recorded for this run.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {researcherData.map((item, i) => (
                  <div
                    key={i}
                    className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <span className="text-xs font-mono uppercase font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                        Finding #{i + 1}
                      </span>
                      <h4 className="text-base font-bold text-white leading-snug">{item.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-mono">Type: Web Evidence</span>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                        >
                          View Source <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Source URL unavailable</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DATA ANALYST TAB */}
        {activeTab === 'data_analyst' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <BarChart3 className="h-6 w-6 text-emerald-400" /> Data Analyst Output
                </h3>
                <p className="text-sm text-slate-300">
                  Quantitative metrics, direct statistics, and derived assumptions
                </p>
              </div>
              {renderStatusBadge(dataAnalystStatus)}
            </div>

            {dataAnalystError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                Error: {dataAnalystError}
              </div>
            )}

            {dataAnalystData.length === 0 ? (
              <div className="p-6 text-center glass-panel rounded-2xl border border-white/10">
                <p className="text-sm font-semibold text-slate-300">No quantitative data metrics recorded.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dataAnalystData.map((item, i) => (
                  <div key={i} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-base font-bold text-emerald-400">{item.title}</h4>
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NEWS AGENT TAB */}
        {activeTab === 'news_agent' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Newspaper className="h-6 w-6 text-purple-400" /> News Agent Output
                </h3>
                <p className="text-sm text-slate-300">
                  2025/2026 industry news, policy shifts, and recent developments
                </p>
              </div>
              {renderStatusBadge(newsStatus)}
            </div>

            {newsError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                Error: {newsError}
              </div>
            )}

            {newsData.length === 0 ? (
              <div className="p-6 text-center glass-panel rounded-2xl border border-white/10 space-y-2">
                <p className="text-sm font-semibold text-slate-300">
                  {newsStatus === 'completed_with_no_results'
                    ? '✓ Completed – No recent 2025/2026 news articles were identified.'
                    : 'No recent news items recorded.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {newsData.map((item, i) => (
                  <div key={i} className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-purple-300 font-bold bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                        Recent Event #{i + 1}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-bold"
                        >
                          View Original Article <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VERIFIER TAB */}
        {activeTab === 'verifier' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <ShieldCheck className="h-6 w-6 text-indigo-400" /> Verifier Agent Output
              </h3>
              <p className="text-sm text-slate-300">Evidence verification matrix & source integrity audit</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-center">
                <span className="text-2xl font-extrabold text-emerald-400">{verifierEvidence.length}</span>
                <p className="text-xs text-slate-300 font-bold uppercase mt-1">Verified Evidence Claims</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center">
                <span className="text-2xl font-extrabold text-rose-400">{unsupportedClaims.length}</span>
                <p className="text-xs text-slate-300 font-bold uppercase mt-1">
                  Flagged / Unsupported Claims
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                Verified Claims Matrix
              </h4>
              {verifierEvidence.map((item, i) => (
                <div key={i} className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {item.claim}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Score: {(item.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Reasoning: <span className="text-slate-200">{item.reasoning}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WRITER TAB */}
        {activeTab === 'writer' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <PenTool className="h-6 w-6 text-violet-400" /> Writer Agent Draft Output
              </h3>
              <p className="text-sm text-slate-300">Draft synthesis history & revision iterations</p>
            </div>

            {writerDraft ? (
              <div className="markdown-content glass-panel p-6 rounded-2xl border border-white/10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{writerDraft}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Draft output not available.</p>
            )}
          </div>
        )}

        {/* CRITIC TAB */}
        {activeTab === 'critic' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <Eye className="h-6 w-6 text-fuchsia-400" /> Critic Agent Output
              </h3>
              <p className="text-sm text-slate-300">Editorial review decision & reflection feedback</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                  Editorial Decision
                </span>
                <span
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase ${
                    criticDecision === 'APPROVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {criticDecision || 'APPROVED'}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                {criticMsg || 'Report approved after editorial quality review.'}
              </p>
            </div>
          </div>
        )}

        {/* FINAL REPORT TAB */}
        {activeTab === 'report' && report && (
          <ReportViewer
            report={report}
            sources={sources}
            criticFeedback={criticFeedback}
            runId={runId}
            onReportUpdated={onReportUpdated}
            onNewChatTrigger={onNewChatTrigger}
          />
        )}
      </div>
    </div>
  );
}
