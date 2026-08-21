import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  const [currentProvider, setProvider] = useState('openrouter/free');

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        <Navbar currentProvider={currentProvider} setProvider={setProvider} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard currentProvider={currentProvider} />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>

        <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
          Autonomous Multi-Agent Research Intelligence System • OpenRouter & Custom LangGraph Architecture
        </footer>
      </div>
    </Router>
  );
}
