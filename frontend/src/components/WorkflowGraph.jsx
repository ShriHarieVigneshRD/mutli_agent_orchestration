import React from 'react';
import {
  BrainCircuit,
  Globe,
  BarChart3,
  Newspaper,
  CheckCircle2,
  PenTool,
  Eye,
  ArrowDown,
  RotateCcw,
  Loader2,
} from 'lucide-react';

export default function WorkflowGraph({
  activeNode,
  completedNodes = [],
  revisionCount = 0,
  status = 'idle',
}) {
  const nodes = [
    {
      id: 'planner',
      name: 'Planner / Supervisor',
      role: 'Decomposes prompt into tasks',
      icon: BrainCircuit,
      color: 'from-amber-500 to-orange-500',
    },
    {
      id: 'researcher',
      name: 'Research Agent',
      role: 'Broad web search & evidence',
      icon: Globe,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      id: 'data_analyst',
      name: 'Data Analyst',
      role: 'Quantitative & statistical metrics',
      icon: BarChart3,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      id: 'news_agent',
      name: 'News Agent',
      role: '2025/2026 current developments',
      icon: Newspaper,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'verifier',
      name: 'Verifier Agent',
      role: 'Cross-checks evidence & claims',
      icon: CheckCircle2,
      color: 'from-indigo-500 to-blue-600',
    },
    {
      id: 'writer',
      name: 'Writer Agent',
      role: 'Synthesizes report draft',
      icon: PenTool,
      color: 'from-violet-500 to-purple-600',
    },
    {
      id: 'critic',
      name: 'Critic Agent',
      role: 'Reflection & quality review',
      icon: Eye,
      color: 'from-fuchsia-500 to-rose-500',
    },
  ];

  const getNodeStatus = (nodeId) => {
    if (activeNode === nodeId) return 'running';
    if (completedNodes.includes(nodeId)) return 'completed';
    return 'idle';
  };

  const getStatusBadge = (nodeStatus) => {
    if (nodeStatus === 'running') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 animate-pulse bg-cyan-950/90 px-3 py-1 rounded-full border border-cyan-500/40 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing
        </span>
      );
    }
    if (nodeStatus === 'completed') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> Done
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10">
        Waiting
      </span>
    );
  };

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden h-full flex flex-col justify-between shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
            <BrainCircuit className="h-5 w-5 text-cyan-400" /> Custom LangGraph Execution Diagram
          </h3>
          <p className="text-sm text-slate-300">Explicit graph routing & parallel multi-agent state</p>
        </div>
        {revisionCount > 0 && (
          <div className="flex items-center gap-2 bg-purple-500/15 border border-purple-500/40 text-purple-300 text-sm font-bold px-4 py-1.5 rounded-xl shadow-md">
            <RotateCcw className="h-4 w-4 animate-spin" /> Critic Reflection Loop: Iteration #{revisionCount}
          </div>
        )}
      </div>

      {/* GRAPH FLOW CONTAINER */}
      <div className="flex flex-col items-center gap-5 my-auto">
        {/* 1. PLANNER NODE */}
        {(() => {
          const pNode = nodes.find((n) => n.id === 'planner');
          const pStatus = getNodeStatus('planner');
          const Icon = pNode.icon;
          return (
            <div
              className={`w-full max-w-lg rounded-2xl p-4.5 border transition-all ${
                pStatus === 'running'
                  ? 'agent-node-active bg-cyan-950/40 border-cyan-500'
                  : pStatus === 'completed'
                    ? 'agent-node-completed bg-emerald-950/30 border-emerald-500/50'
                    : 'bg-slate-900/70 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${pNode.color} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{pNode.name}</h4>
                    <p className="text-xs text-slate-300 font-medium">{pNode.role}</p>
                  </div>
                </div>
                {getStatusBadge(pStatus)}
              </div>
            </div>
          );
        })()}

        {/* Arrow down to parallel split */}
        <div className="flex items-center justify-center text-slate-400 my-1">
          <ArrowDown className="h-5 w-5 animate-bounce" />
          <span className="text-xs uppercase tracking-widest font-bold text-slate-300 ml-2">
            Parallel Fan-Out
          </span>
        </div>

        {/* 2. PARALLEL AGENTS ROW (Researcher, Data Analyst, News Agent) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {['researcher', 'data_analyst', 'news_agent'].map((nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            const nStatus = getNodeStatus(nodeId);
            const Icon = node.icon;
            return (
              <div
                key={nodeId}
                className={`rounded-2xl p-4 border transition-all ${
                  nStatus === 'running'
                    ? 'agent-node-active bg-cyan-950/40 border-cyan-500'
                    : nStatus === 'completed'
                      ? 'agent-node-completed bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-slate-900/70 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-tr ${node.color} text-white shadow-md`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {getStatusBadge(nStatus)}
                </div>
                <h4 className="text-base font-bold text-white mb-1">{node.name}</h4>
                <p className="text-xs text-slate-300 leading-snug font-medium">{node.role}</p>
              </div>
            );
          })}
        </div>

        {/* Arrow down to verifier */}
        <div className="flex items-center justify-center text-slate-400 my-1">
          <ArrowDown className="h-5 w-5" />
          <span className="text-xs uppercase tracking-widest font-bold text-slate-300 ml-2">
            Fan-In Evidence Aggregation
          </span>
        </div>

        {/* 3. VERIFIER NODE */}
        {(() => {
          const vNode = nodes.find((n) => n.id === 'verifier');
          const vStatus = getNodeStatus('verifier');
          const Icon = vNode.icon;
          return (
            <div
              className={`w-full max-w-xl rounded-2xl p-4 border transition-all ${
                vStatus === 'running'
                  ? 'agent-node-active bg-cyan-950/40 border-cyan-500'
                  : vStatus === 'completed'
                    ? 'agent-node-completed bg-emerald-950/30 border-emerald-500/50'
                    : 'bg-slate-900/70 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${vNode.color} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{vNode.name}</h4>
                    <p className="text-xs text-slate-300 font-medium">{vNode.role}</p>
                  </div>
                </div>
                {getStatusBadge(vStatus)}
              </div>
            </div>
          );
        })()}

        {/* Arrow down to writer & critic */}
        <div className="flex items-center justify-center text-slate-400">
          <ArrowDown className="h-5 w-5" />
        </div>

        {/* 4. WRITER & CRITIC PIPELINE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
          {['writer', 'critic'].map((nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            const nStatus = getNodeStatus(nodeId);
            const Icon = node.icon;
            return (
              <div
                key={nodeId}
                className={`rounded-2xl p-4 border transition-all ${
                  nStatus === 'running'
                    ? 'agent-node-active bg-purple-950/40 border-purple-500'
                    : nStatus === 'completed'
                      ? 'agent-node-completed bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-slate-900/70 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-tr ${node.color} text-white shadow-md`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {getStatusBadge(nStatus)}
                </div>
                <h4 className="text-base font-bold text-white mb-1">{node.name}</h4>
                <p className="text-xs text-slate-300 leading-snug font-medium">{node.role}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
