import { defineConfig } from '@playwright/test';

// Runs focused layout contracts against the real Vite application and the host machine's Chrome installation.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.js',
  outputDir: 'dist/playwright-results',
  // Parallel files stay within the host's cores alongside each page's own simulation workers: four lanes locally,
  // three on the four-vCPU CI runners where those in-page pools would otherwise oversubscribe every core.
  workers: process.env.CI ? 3 : 4,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
