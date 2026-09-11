import { expect, test } from '@playwright/test';

// RNG workers must finish real trials without importing the browser editor or result views.
test('RNG workers simulate without loading UI dependencies', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const workerReady = page.waitForEvent('worker', (worker) => worker.url().includes('random-distribution-worker'));
  const result = await page.evaluate(() => {
    const app = window.professionApp;
    const request = { ...app.adapter.randomDistributionRequest(app), trials: 2 };
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/random-distribution/random-distribution-worker.ts', {
        type: 'module'
      });
      const progress = [];
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else if (data.progress) progress.push(data.progress.completed);
        else resolve({ requestId: data.requestId, distribution: data.distribution, progress });
      });
      worker.postMessage({ requestId: 1, request, includeSamples: true });
    });
  });
  expect(result.requestId).toBe(1);
  expect(result.progress[0]).toBe(0);
  expect(result.progress.at(-1)).toBe(2);
  expect(result.distribution.trials).toBe(2);
  expect(result.distribution.mean).toBeGreaterThan(0);
  expect(result.distribution.samples).toHaveLength(2);

  const worker = await workerReady;
  const uiImports = await worker.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\/app\/(?:create-adapter\.|build-editor\.|build\/|rotation\/|results\/)/.test(url))
  );
  expect(uiImports).toEqual([]);
});
