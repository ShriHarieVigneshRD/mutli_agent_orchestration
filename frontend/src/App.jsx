import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { EmptyState } from './components/ui/States';
import { useModelSettings } from './hooks/useModelSettings';
import HistoryPage from './pages/HistoryPage';
import RunPage from './pages/RunPage';
import WorkspacePage from './pages/WorkspacePage';

function NotFound() {
  return (
    <EmptyState title="This page does not exist." className="py-24">
      <Link to="/" className="text-accent hover:underline">
        Go to the workspace
      </Link>
    </EmptyState>
  );
}

export default function App() {
  const modelSettings = useModelSettings();
  const offline = modelSettings.catalogue?.llm_configured === false;

  return (
    <BrowserRouter>
      <div className="flex min-h-dvh flex-col">
        <AppHeader offline={offline} />
        <main id="main" className="flex-1">
          <Routes>
            <Route path="/" element={<WorkspacePage modelSettings={modelSettings} offline={offline} />} />
            <Route path="/runs/:runId" element={<RunPage catalogue={modelSettings.catalogue} />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer className="border-t border-rule px-4 py-4 text-center text-xs text-ink-3">
          ResearchGraph: seven agents, one cited brief. Reports can be wrong; check the sources.
        </footer>
      </div>
    </BrowserRouter>
  );
}
