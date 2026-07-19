import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const e2eHost = process.env.E2E_HOST || "127.0.0.1";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/production-smoke.spec.ts",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: process.env.E2E_REPORT_DIR || "playwright-report",
      },
    ],
  ],
  outputDir: process.env.E2E_RESULTS_DIR || "test-results",
  use: {
    baseURL: `http://${e2eHost}:4176`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: chromiumExecutable
      ? { executablePath: chromiumExecutable }
      : undefined,
  },
  webServer: [
    {
      command: "python -m uvicorn app.main:app --host 0.0.0.0 --port 8012",
      cwd: "../backend",
      env: {
        PYTHONPATH: ".",
        CORS_ORIGINS: `http://${e2eHost}:4176`,
        PUBLIC_DEMO_MODE: "true",
        PUBLIC_DEMO_TOKEN: "e2e-token",
        PUBLIC_DEMO_MODEL_CALLS_PER_MINUTE: "1",
        PUBLIC_DEMO_MODEL_CALLS_PER_DAY: "5",
        PUBLIC_DEMO_MODEL_DAILY_BUDGET: "20",
        LLM_PROVIDER_MODE: "deepseek",
        DEEPSEEK_API_KEY: "e2e-fake-key",
        DEEPSEEK_BASE_URL: "http://127.0.0.1:9",
        DEEPSEEK_MODEL: "e2e-model",
        LLM_TIMEOUT_SECONDS: "0.2",
      },
      url: "http://localhost:8012/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 0.0.0.0 --port 4176",
      cwd: ".",
      env: { VITE_API_BASE: `http://${e2eHost}:8012` },
      url: "http://localhost:4176",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
