import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mcp-app',
  outputDir: './dist/playwright',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4177', browserName: 'chromium', viewport: { width: 1280, height: 1000 }, locale: 'en-US', timezoneId: 'America/Los_Angeles', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/mcp-app/serve.mjs', url: 'http://127.0.0.1:4177', reuseExistingServer: false, timeout: 30_000 },
});
