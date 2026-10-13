import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { observations, query } from './fixtures.mjs';

async function openApp(page, view = 'weather', extra = '') {
  await page.goto(`/?view=${view}${extra}`);
  await expect.poll(() => page.evaluate(() => window.fixtureHost?.initialized)).toBe(true);
  const app = page.frameLocator('iframe');
  if (!extra.includes('loading')) await expect(app.locator('#content')).toHaveAttribute('aria-busy', 'false');
  return app;
}

test('official host bridge renders weather, changes metrics, and refreshes the original arguments', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  const app = await openApp(page);
  await expect(app.locator('h1')).toContainText(/observations|weather|archive/i);
  await expect(app.locator('svg').first()).toBeVisible();
  await expect(app.locator('table tbody tr').first()).toBeVisible();
  const select = app.locator('.metric-select').first();
  const before = await app.locator('.chart').first().textContent();
  await select.selectOption({ index: 1 });
  await expect(app.locator('.chart').first()).not.toHaveText(before);
  await app.getByRole('button', { name: 'Refresh', exact: false }).click();
  await expect.poll(() => page.evaluate(() => window.fixtureHost.calls.length)).toBe(1);
  expect(await page.evaluate(() => window.fixtureHost.calls[0])).toMatchObject({
    name: 'get_observations', arguments: { start: '2026-06-14', end: '2026-06-14', bucket_minutes: 30 },
  });
  expect(requests.every((url) => url.startsWith('http://127.0.0.1:4177/'))).toBe(true);
  expect(errors).toEqual([]);
});

test('SQL table filters, sorts numerically, paginates, and shows truncation', async ({ page }) => {
  const app = await openApp(page, 'table');
  await expect(app.locator('table tbody tr')).toHaveCount(8);
  await expect(app.locator('#content')).toContainText(/more rows|truncat|limit/i);
  const next = app.getByRole('button', { name: /next page/i });
  await next.click();
  await expect(app.locator('table tbody tr').first()).toContainText('2026-04-09');
  await app.locator('input[type="search"]').fill('Partial');
  await expect(app.locator('table tbody tr')).toHaveCount(1);
  await expect(app.locator('table tbody tr').first()).toContainText('2026-04-06');
  await app.locator('input[type="search"]').fill('');
  await app.locator('thead th').nth(1).getByRole('button').click();
  await expect(app.locator('thead th').nth(1)).toHaveAttribute('aria-sort', 'ascending');
  const values = await app.locator('tbody tr td:nth-child(2)').allTextContents();
  const nums = values.map((value) => Number(value.replaceAll(',', ''))).filter(Number.isFinite);
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
  await app.locator('thead th').nth(1).getByRole('button').click();
  await expect(app.locator('thead th').nth(1)).toHaveAttribute('aria-sort', 'descending');
  await app.locator('input[type="search"]').fill('does not exist');
  await expect(app.locator('#content')).toContainText(/no .*match|no results/i);
});

test('missing values remain distinct from zero and hostile cells remain text', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(async () => window.fixtureHost.send({
    columns: ['label', 'reading'], rows: [['<img src=x onerror="window.injected=true">', null], ['measured zero', 0]], row_count: 2,
  }));
  await expect(app.locator('tbody tr')).toHaveCount(2);
  await expect(app.locator('tbody tr').first()).toContainText('<img src=x');
  await expect(app.locator('tbody tr').first().locator('td').nth(1)).toHaveText('—');
  await expect(app.locator('tbody tr').nth(1).locator('td').nth(1)).toHaveText('0');
  await expect(app.locator('img')).toHaveCount(0);
  expect(await page.frames()[1].evaluate(() => window.injected)).toBeUndefined();
});

test('query column order and duplicate labels retain every value', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(() => window.fixtureHost.send({ columns: ['value', 'value', '__proto__'], rows: [[12, 34, 'safe']], row_count: 1 }));
  await expect(app.locator('tbody tr td')).toHaveText(['12', '34', 'safe']);
});

test('a missing temperature produces a gap instead of a zero reading', async ({ page }) => {
  const app = await openApp(page);
  const sparse = structuredClone(observations);
  sparse.points = [sparse.points[0], { ...sparse.points[1], temp_avg_f: null }, sparse.points[2]];
  await page.evaluate((data) => window.fixtureHost.send(data), sparse);
  await expect(app.locator('tbody tr')).toHaveCount(3);
  await expect(app.locator('tbody tr').nth(1)).toContainText('—');
  await expect(app.locator('.chart-line')).toHaveCount(2);
});

test('absent archive buckets break the plotted line', async ({ page }) => {
  const app = await openApp(page);
  const sparse = { ...observations, points: [observations.points[0], observations.points[1], observations.points[5], observations.points[6]] };
  await page.evaluate((data) => window.fixtureHost.send(data), sparse);
  await expect(app.locator('.chart-line')).toHaveCount(2);
});

test('an empty wind rose does not invent a preferred direction', async ({ page }) => {
  const app = await openApp(page, 'wind');
  await page.evaluate(() => {
    const data = structuredClone(window.fixtureHost.fixture.data);
    data.obs = 0; data.calm_pct = 0;
    data.sectors.forEach((row) => { row.pct = 0; row.count = 0; });
    return window.fixtureHost.send(data);
  });
  await expect(app.locator('.wind-note')).toContainText('No directional readings');
});

for (const view of ['daily', 'forecast', 'wind', 'conditions']) {
  test(`${view} tool view renders its actual structured shape`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const app = await openApp(page, view);
    await expect(app.locator('.hero')).toBeVisible();
    if (view !== 'conditions') await expect(app.locator('svg').first()).toBeVisible();
    if (view === 'conditions') await expect(app.locator('#content')).toContainText(/archive/i);
    expect(errors).toEqual([]);
  });
}

test('host theme updates and narrow screens keep the document in bounds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = await openApp(page, 'table', '&theme=dark');
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => window.fixtureHost.setTheme('light'));
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.frames()[1].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(app.getByRole('button', { name: /next page/i })).toBeVisible();
});

test('empty results and a failed refresh recover without losing the result', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(() => { window.fixtureHost.nextError = 'Synthetic refresh failed'; });
  await app.getByRole('button', { name: /refresh/i }).click();
  await expect(app.locator('#message')).toContainText(/failed|error|could not/i);
  await expect(app.locator('tbody tr')).toHaveCount(8);
  await app.getByRole('button', { name: /refresh/i }).click();
  await expect(app.locator('#message')).toBeHidden();
  await page.evaluate(() => window.fixtureHost.send({ columns: ['day', 'rain_mm'], rows: [], row_count: 0 }));
  await expect(app.locator('#content')).toContainText(/no .*rows|no .*data|no .*results|no readings/i);
});

test('loading state performs no automatic tool calls', async ({ page }) => {
  const app = await openApp(page, 'weather', '&loading');
  await expect(app.locator('#message')).toBeVisible();
  expect(await page.evaluate(() => window.fixtureHost.calls)).toEqual([]);
  await page.evaluate((data) => window.fixtureHost.send(data), observations);
  await expect(app.locator('svg').first()).toBeVisible();
});

test('a host without tool capability cannot trigger refresh', async ({ page }) => {
  const app = await openApp(page, 'weather', '&noTools');
  await expect(app.locator('#refresh')).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureHost.calls)).toEqual([]);
});

test('refresh waits for the original input instead of inventing arguments', async ({ page }) => {
  const app = await openApp(page, 'table', '&noInput');
  await expect(app.locator('#refresh')).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureHost.calls)).toEqual([]);
});

test('plain JSON text content is a supported result fallback', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate((data) => window.fixtureHost.bridge.sendToolResult({ content: [{ type: 'text', text: JSON.stringify(data) }] }), { ...query, rows: query.rows.slice(0, 2), row_count: 2, truncated: false });
  await expect(app.locator('tbody tr')).toHaveCount(2);
});

test('large results are bounded before rendering and disclose the display limit', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(() => window.fixtureHost.send({
    columns: Array.from({ length: 70 }, (_, i) => `column_${i}`),
    rows: Array.from({ length: 2100 }, (_, i) => Array.from({ length: 70 }, (_, j) => i + j)),
    row_count: 2100,
  }));
  await expect(app.locator('thead th')).toHaveCount(64);
  await expect(app.locator('tbody tr')).toHaveCount(8);
  await expect(app.locator('#content')).toContainText('Display limited to 2,000 rows and 64 columns');
});

test('a late refresh cannot replace a newer host-pushed result', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(() => { window.fixtureHost.holdNextCall = true; });
  await app.locator('#refresh').click();
  await expect.poll(() => page.evaluate(() => typeof window.fixtureHost.releaseCall)).toBe('function');
  await expect(app.locator('#refresh')).toBeDisabled();
  await page.evaluate(async () => {
    await window.fixtureHost.send({ columns: ['newer'], rows: [['Latest host result']], row_count: 1 });
    window.fixtureHost.releaseCall();
    // A round-trip ensures queued bridge messages are delivered before assertions.
    await window.fixtureHost.bridge.request({ method: 'ping' });
  });
  await expect(app.locator('tbody tr')).toHaveCount(1);
  await expect(app.locator('tbody')).toContainText('Latest host result');
});

test('malformed results surface an error and recover on valid host data', async ({ page }) => {
  const app = await openApp(page, 'table');
  await page.evaluate(() => window.fixtureHost.bridge.sendToolResult({ content: [{ type: 'text', text: '{invalid JSON' }] }));
  await expect(app.locator('#message')).toContainText('invalid JSON');
  await expect(app.locator('table')).toHaveCount(0);
  await page.evaluate((data) => window.fixtureHost.send(data), query);
  await expect(app.locator('tbody tr')).toHaveCount(8);
});

test('documentation screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  for (const [view, name] of [['weather', 'mcp-app-weather.png'], ['table', 'mcp-app-table.png']]) {
    const app = await openApp(page, view);
    await expect(app.locator('tbody tr').first()).toBeVisible();
    if (process.env.CAPTURE_SCREENSHOTS === '1') {
      await mkdir('docs/screenshots', { recursive: true });
      await page.locator('iframe').screenshot({ path: `docs/screenshots/${name}`, animations: 'disabled' });
    }
  }
});
