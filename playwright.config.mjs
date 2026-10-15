import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:8837', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npx wrangler dev --port 8837', url: 'http://localhost:8837/api/health', reuseExistingServer: !process.env.CI, timeout: 30000 },
  reporter: 'list',
});
