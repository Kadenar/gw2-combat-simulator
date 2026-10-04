import { defineConfig } from '@playwright/test';

// Runs focused layout contracts against the real Vite application and the host machine's Chrome installation.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.js',
  outputDir: 'dist/playwright-results',
  // Cold Vite transforms take about 40s on the first parallel pages; retain a finite deadline for stalled tests.
  timeout: 60_000,
  // Each page also starts simulation workers; two local lanes keep cold imports within the host's budget.
  // CI retains its existing three lanes on the dedicated runner.
  workers: process.env.CI ? 3 : 2,
  // Cold profession imports can take about 40s; allow readiness to settle within the existing 60s test deadline.
  expect: { timeout: 45_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    // Capture diagnostics only when an assertion fails, rather than on every successful run.
    screenshot: 'only-on-failure',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
