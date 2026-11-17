import { History, Moon, Plus, Sun, WifiOff } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

/** The routing-slip mark: a slip with three lines and the "current desk" dot. */
export function Mark({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="4" y="2.5" width="16" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="16" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Moon aria-hidden className="h-4 w-4" /> : <Sun aria-hidden className="h-4 w-4" />}
    </Button>
  );
}

const navClass = ({ isActive }) =>
  `inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm transition-colors duration-150 max-md:h-11 ${
    isActive ? 'bg-well font-medium text-ink' : 'text-ink-3 hover:text-ink'
  }`;

export function AppHeader({ offline }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:gap-4 md:px-6 xl:px-8">
        <Link to="/" className="mr-1 flex items-center gap-2 text-ink" aria-label="ResearchGraph home">
          <Mark />
          <span className="font-serif text-lg font-semibold tracking-tight max-[420px]:hidden">
            ResearchGraph
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            <Plus aria-hidden className="h-4 w-4 md:hidden" />
            <span className="max-md:sr-only">Workspace</span>
          </NavLink>
          <NavLink to="/history" className={navClass}>
            <History aria-hidden className="h-4 w-4 md:hidden" />
            <span className="max-md:sr-only">History</span>
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {offline && (
            <Badge tone="caution" icon={WifiOff} className="max-sm:hidden">
              <span title="OPENROUTER_API_KEY is not set: reports are assembled without AI">
                Offline demo
              </span>
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
