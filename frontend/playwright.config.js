import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const API_PORT = 8799;
const WEB_PORT = 5198;
// A fresh database per e2e run; the real backend/.env (OpenRouter key, Neon URL) is never used.
const DB = path.join(os.tmpdir(), `research-e2e-${Date.now()}.db`).replaceAll('\\', '/');

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'msedge', // the system Edge: no browser download needed
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        OPENROUTER_API_KEY: '',
        TAVILY_API_KEY: '',
        SEARCH_PROVIDER: 'off', // deterministic and offline: no DuckDuckGo calls
        DATABASE_URL: `sqlite+aiosqlite:///${DB}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        RESEARCH_RATE_LIMIT_PER_HOUR: '1000',
        CHAT_RATE_LIMIT_PER_MIN: '1000',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
