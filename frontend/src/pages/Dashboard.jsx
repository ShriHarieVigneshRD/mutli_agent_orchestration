import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Play, 
  Loader2, 
  Compass, 
  Zap, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers
} from 'lucide-react';

import WorkflowGraph from '../components/WorkflowGraph';
import EventStreamLog from '../components/EventStreamLog';
import AgentInspector from '../components/AgentInspector';
import { createResearchRun, getResearchRun, subscribeToRunEvents } from '../services/api';

const EXAMPLE_PROMPTS = [
  "Analyze how AI coding agents may impact junior software engineering jobs over the next 3–5 years.",
  "Evaluate the market potential and technical hurdles of Quantum Computing in Cryptography.",
  "Investigate current 2025/2026 trends in Autonomous Vehicle Regulation & AI Safety Standards."
];

export default function Dashboard({ currentProvider }) {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  const [runStatus, setRunStatus] = useState('idle'); // idle | running | completed | failed
  const [activeNode, setActiveNode] = useState(null);
  const [completedNodes, setCompletedNodes] = useState([]);
  const [revisionCount, setRevisionCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [agentLogs, setAgentLogs] = useState({});
  const [reportData, setReportData] = useState(null);
  const [sources, setSources] = useState([]);
  const [criticFeedback, setCriticFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showGraph, setShowGraph] = useState(true);

  const textareaRef = useRef(null);

  // Auto-expand textarea like ChatGPT
  const handleTextareaChange = (e) => {
    setQuery(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  };

  // Handle SSE Subscription when activeRunId changes
  useEffect(() => {
    if (!activeRunId) return;

    const unsubscribe = subscribeToRunEvents(
      activeRunId,
      (eventData) => {
        const { event, data } = eventData;
        const timeStr = new Date().toLocaleTimeString();

        setLogs((prev) => [...prev, { event, data, timestamp: timeStr }]);

        // Handle node state transitions and store rich node details
        if (event && event.endsWith('_completed')) {
          const nodeName = event.replace('_completed', '');
          setActiveNode(null);
          setCompletedNodes((prev) => [...new Set([...prev, nodeName])]);
          
          if (data?.details) {
            setAgentLogs((prev) => ({
              ...prev,
              [nodeName]: data.details
            }));
          }
        } else if (event && event.endsWith('_started')) {
          const nodeName = event.replace('_started', '');
          setActiveNode(nodeName);
        }

        if (data && data.state_summary) {
          if (data.state_summary.revision_count) {
            setRevisionCount(data.state_summary.revision_count);
          }
          if (data.state_summary.critic_feedback) {
            setCriticFeedback(data.state_summary.critic_feedback);
          }
        }

        if (event === 'research_completed') {
          setRunStatus('completed');
          fetchRunDetails(activeRunId);
        } else if (event === 'research_failed') {
          setRunStatus('failed');
          setErrorMsg(data?.error || 'Research workflow failed.');
        }
      },
      (err) => {
        console.error('SSE Error:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeRunId]);

  const fetchRunDetails = async (runId) => {
    try {
      const data = await getResearchRun(runId);
      if (data.report) {
        setReportData(data.report);
      }
      if (data.sources) {
        setSources(data.sources);
      }
      if (data.logs) {
        const map = {};
        data.logs.forEach(l => {
          if (l.details) map[l.agent_name] = l.details;
        });
        setAgentLogs(map);
      }
    } catch (err) {
      console.error('Failed to fetch full run details:', err);
    }
  };

  const handleStartResearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setRunStatus('running');
    setLogs([]);
    setAgentLogs({});
    setCompletedNodes([]);
    setActiveNode('planner');
    setRevisionCount(0);
    setReportData(null);
    setSources([]);
    setErrorMsg('');
    setShowGraph(true);

    try {
      const res = await createResearchRun(query.trim(), currentProvider);
      setActiveRunId(res.run_id);
    } catch (err) {
      console.error('Failed to launch research:', err);
      setRunStatus('failed');
      setErrorMsg(err.message || 'Could not launch research workflow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] px-6 sm:px-10 py-8 space-y-8">
      {/* HERO SECTION & CHATGPT-STYLE PROMPT BOX */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="max-w-4xl space-y-3.5 mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs sm:text-sm font-semibold">
            <Zap className="h-4 w-4" /> Custom LangGraph Multi-Agent Architecture
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            What would you like to <br />
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              research today?
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Enter a complex research prompt. Supervisor Planner decomposes the question into specialized tasks, coordinates Researcher, Data Analyst, and News agents in parallel, verifies claims, and refines reports via Critic reflection loops.
          </p>
        </div>

        {/* CHATGPT-STYLE PROMPT INPUT */}
        <form onSubmit={handleStartResearch} className="space-y-4">
          <div className="relative rounded-2xl bg-slate-950/90 border border-white/15 p-5 shadow-2xl focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
            <textarea
              ref={textareaRef}
              rows={3}
              value={query}
              onChange={handleTextareaChange}
              placeholder="Ask anything... e.g. Analyze how AI coding agents may impact junior software engineering jobs over the next 3-5 years."
              className="w-full bg-transparent text-base sm:text-xl text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed max-h-[250px] overflow-y-auto"
            />

            <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-3">
              <span className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-cyan-400" /> Powered by LangGraph & OpenRouter Multi-LLM Engine
              </span>

              <button
                type="submit"
                disabled={!query.trim() || isSubmitting || runStatus === 'running'}
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white text-sm sm:text-base font-bold shadow-xl shadow-cyan-500/25 transition-all"
              >
                {runStatus === 'running' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Running Agents...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-white" /> Research Prompt
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TEMPLATE SUGGESTIONS */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm pt-1">
            <span className="text-slate-300 flex items-center gap-1.5 font-bold">
              <Compass className="h-4 w-4 text-cyan-400" /> Example Prompts:
            </span>
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuery(prompt);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm border border-white/10 transition-all text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-950/40 border border-rose-500/30 p-5 flex items-center gap-3.5 text-rose-300 text-base">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* WORKFLOW GRAPH & REAL-TIME EVENT STREAM */}
      {(runStatus === 'running' || logs.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-cyan-400" /> Multi-Agent Execution Progress
            </h3>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-bold bg-slate-900 px-4 py-2 rounded-xl border border-white/10 shadow-sm"
            >
              {showGraph ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showGraph ? 'Hide Graph Diagram' : 'Show Graph Diagram'}
            </button>
          </div>

          {showGraph && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2">
                <WorkflowGraph
                  activeNode={activeNode}
                  completedNodes={completedNodes}
                  revisionCount={revisionCount}
                  status={runStatus}
                />
              </div>
              <div className="lg:col-span-1">
                <EventStreamLog logs={logs} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* AGENT INSPECTOR & MULTI-AGENT VISIBILITY INTERFACE */}
      {(completedNodes.length > 0 || reportData) && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2.5 px-2">
            <Layers className="h-5 w-5 text-purple-400" /> Agent Output Inspection & Source Verification
          </h3>
          <AgentInspector
            query={query}
            status={runStatus}
            completedNodes={completedNodes}
            agentLogs={agentLogs}
            sources={sources}
            report={reportData}
            criticFeedback={criticFeedback}
            revisionCount={revisionCount}
            runId={activeRunId}
            onReportUpdated={(updatedMd) => setReportData((prev) => ({ ...(prev || {}), full_markdown: updatedMd }))}
            onNewChatTrigger={() => {
              setQuery('');
              setRunStatus('idle');
              setActiveRunId(null);
              setReportData(null);
              setCompletedNodes([]);
              setLogs([]);
              setAgentLogs({});
              if (textareaRef.current) textareaRef.current.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
