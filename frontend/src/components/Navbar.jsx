import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Cpu, History, Sparkles, ChevronDown } from 'lucide-react';

const OPENROUTER_MODELS = [
  { id: 'openrouter/free', name: '🌟 OpenRouter Auto Free Router' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: '🦙 Llama 3.3 70B (Free)' },
  { id: 'deepseek/deepseek-r1:free', name: '🧠 DeepSeek R1 (Free)' },
  { id: 'google/gemini-2.0-flash-exp:free', name: '⚡ Gemini 2.0 Flash (Free)' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: '💻 Qwen 2.5 72B (Free)' },
  { id: 'mistralai/mistral-7b-instruct:free', name: '🔷 Mistral 7B (Free)' },
];

export default function Navbar({ currentProvider, setProvider }) {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1700px] items-center justify-between px-6 py-4 sm:px-10">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-0.5 shadow-xl shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <Bot className="h-6 w-6 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                ResearchGraph AI
              </span>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                OpenRouter Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Autonomous Multi-Agent Intelligence</p>
          </div>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-5 sm:gap-8">
          {/* OpenRouter Model Selector Dropdown */}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-900/90 p-1.5 border border-white/15 shadow-md">
            <span className="px-2.5 text-slate-300 flex items-center gap-1.5 font-semibold text-xs sm:text-sm">
              <Cpu className="h-4 w-4 text-indigo-400" /> Model:
            </span>
            <div className="relative">
              <select
                value={currentProvider}
                onChange={(e) => setProvider(e.target.value)}
                className="appearance-none bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-4 py-2 pr-9 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
              >
                {OPENROUTER_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-950 text-white py-1">
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname === '/'
                  ? 'bg-white/10 text-white shadow-inner border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Workspace
            </Link>
            <Link
              to="/history"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname === '/history'
                  ? 'bg-white/10 text-white shadow-inner border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="h-4 w-4 text-purple-400" />
              History
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
