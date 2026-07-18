import { defineConfig, devices } from '@playwright/test'

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
  },
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8012',
      cwd: '../backend',
      env: { PYTHONPATH: '.', CORS_ORIGINS: 'http://localhost:4176' },
      url: 'http://localhost:8012/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4176',
      cwd: '.',
      env: { VITE_API_BASE: 'http://localhost:8012' },
      url: 'http://localhost:4176',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
