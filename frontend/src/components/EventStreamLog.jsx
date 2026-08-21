import React from 'react';
import { Terminal, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export default function EventStreamLog({ logs = [] }) {
  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col h-full min-h-[550px] shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live SSE Event Stream</h3>
        </div>
        <span className="flex items-center gap-2 text-xs text-emerald-400 font-mono font-bold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span> Real-time Connected
        </span>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-sm space-y-3 pr-2">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
            Waiting for research execution to start...
          </div>
        ) : (
          logs.map((log, index) => {
            const isCompleted = log.event?.includes('completed') || log.event === 'research_completed';
            const isFailed = log.event?.includes('failed');

            return (
              <div key={index} className="flex items-start gap-3 bg-slate-900/80 rounded-2xl p-3.5 border border-white/10 shadow-sm">
                <span className="text-xs text-slate-400 shrink-0 font-mono mt-0.5">
                  {log.timestamp || new Date().toLocaleTimeString()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : isFailed ? (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    ) : (
                      <Activity className="h-4 w-4 text-cyan-400 shrink-0 animate-spin" />
                    )}
                    <span className="font-bold text-slate-100 text-sm capitalize">
                      {log.event?.replace('_', ' ')}
                    </span>
                  </div>
                  {log.data && (
                    <p className="text-xs text-slate-300 mt-1.5 truncate leading-relaxed">
                      {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
