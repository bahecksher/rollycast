import { defineConfig, devices } from '@playwright/test';

/**
 * Two isolated browser contexts drive the multiplayer E2E flow (spec §38.3). The full
 * room/roll/reroll/reconnect script is added in later milestones; the web server + worker
 * are started together via the dev scripts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // One worker at a time: each case drives 2-3 browser contexts, a heavy WebGL scene, and a single
  // local Durable Object. Parallel workers overwhelm that and cause flaky WebSocket/WebGL failures.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-portrait', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm run dev:worker',
      url: 'http://127.0.0.1:8787/parties/room/AAAAAA',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace apps/web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
