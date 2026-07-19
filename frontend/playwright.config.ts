import { defineConfig, devices } from '@playwright/test'

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
const e2eHost = process.env.E2E_HOST || '127.0.0.1'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: process.env.E2E_REPORT_DIR || 'playwright-report' }]],
  outputDir: process.env.E2E_RESULTS_DIR || 'test-results',
  use: {
    baseURL: `http://${e2eHost}:4176`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
  },
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --host 0.0.0.0 --port 8012',
      cwd: '../backend',
      env: { PYTHONPATH: '.', CORS_ORIGINS: `http://${e2eHost}:4176` },
      url: 'http://localhost:8012/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 0.0.0.0 --port 4176',
      cwd: '.',
      env: { VITE_API_BASE: `http://${e2eHost}:8012` },
      url: 'http://localhost:4176',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
