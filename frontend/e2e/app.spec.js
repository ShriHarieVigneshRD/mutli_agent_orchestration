import { expect, test } from '@playwright/test';

const SHOTS = 'test-results/screenshots';
const QUESTION = 'How has rooftop solar changed household electricity bills since 2020?';

/** Fail any test that logs a console error or warning. */
test.beforeEach(async ({ page }) => {
  const problems = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  page.problems = problems;
});

test.afterEach(async ({ page }) => {
  expect(page.problems, 'console errors/warnings').toEqual([]);
});

async function startRun(page, question = QUESTION) {
  await page.goto('/');
  await page.getByLabel('Research question').fill(question);
  await page.getByRole('button', { name: 'Start research' }).click();
  await expect(page).toHaveURL(/\/runs\/[\w-]+$/);
  await expect(page.getByText('Finished', { exact: true })).toBeVisible({ timeout: 60_000 });
}

test('research flow: compose, watch, read, chat, history, delete', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What should the desk look into?' })).toBeVisible();
  await expect(page.getByText(/Offline demo mode/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/workspace.png` });

  // Model picker: single-model mode reveals the model list.
  await page.getByLabel('Models').selectOption('single');
  await expect(page.getByLabel('Model for all agents')).toBeVisible();
  await page.getByLabel('Models').selectOption('per_agent');

  await startRun(page);
  const runUrl = page.url();
  await expect(page.getByRole('heading', { level: 1, name: QUESTION })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/Offline demo: no language model/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/run-report.png` });

  // Every desk is inspectable from the routing slip.
  await page.getByRole('button', { name: /Planner/ }).click();
  await expect(page.getByText('Tasks', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Researcher/ }).click();
  await expect(page.getByText('Search returned no web results.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/run-desk.png` });

  // Report chat (offline reply), then back to the report.
  await page.getByRole('button', { name: /^08\s*Report/ }).click();
  await page.getByLabel('Follow-up question').fill('Summarise this in one line');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Offline demo mode: no language model is configured/)).toBeVisible();

  // Refreshing a finished run restores it from the server.
  await page.reload();
  await expect(page.getByText('Finished', { exact: true })).toBeVisible();
  await expect(page.getByText('Summarise this in one line')).toBeVisible();

  // History lists it; delete with confirmation.
  await page.getByRole('link', { name: 'History' }).click();
  const row = page.getByRole('link', { name: new RegExp(QUESTION.slice(0, 30)) }).first();
  await expect(row).toHaveAttribute('href', new URL(runUrl).pathname);
  await page.screenshot({ path: `${SHOTS}/history.png` });
  const before = await page.getByRole('button', { name: /^Delete run:/ }).count();
  await page
    .getByRole('button', { name: /^Delete run:/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete run' }).click();
  await expect(page.getByRole('button', { name: /^Delete run:/ })).toHaveCount(before - 1);
});

test('theme toggle switches to dark and survives a reload', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Dark theme' });
  const start = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  const flipped = start === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', flipped);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', flipped);
});

test('dark theme screenshot of a run', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await startRun(page, 'What are the trade-offs of heat pumps in cold climates?');
  await page.screenshot({ path: `${SHOTS}/run-report-dark.png` });
});

for (const [name, width, height] of [
  ['mobile', 390, 844],
  ['tablet', 820, 1180],
  ['desktop', 1440, 900],
]) {
  test(`no horizontal overflow at ${name} width (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startRun(page, `Responsive check at ${width}px: wind power costs in Europe`);
    const runPath = new URL(page.url()).pathname;
    for (const path of ['/', runPath, '/history']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} at ${width}px`).toBeLessThanOrEqual(width);
    }
    if (name !== 'desktop') {
      await page.goto(runPath);
      await expect(page.getByText('Finished', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/run-${name}.png` });
    }
  });
}

test('keyboard: skip link and tab arrows work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await startRun(page, 'Keyboard check: battery storage prices');
  await page.getByRole('tab', { name: 'Report' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true');
});
