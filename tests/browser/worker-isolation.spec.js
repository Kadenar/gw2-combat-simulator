import { expect, test } from '@playwright/test';

// Both prepared jobs must finish in real module workers without importing browser adapters, editors, or result views.
test('modifier and RNG workers simulate without loading UI dependencies', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const uiImports = (worker) =>
    worker.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /\/app\/(?:create-adapter\.|build-editor\.|build\/|rotation\/|results\/)/.test(url))
    );

  const modifierWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('modifier-contribution-worker')
  );
  const contributions = await page.evaluate(() => {
    const app = window.professionApp;
    app.modifierContributionRunner.cancel();
    const request = app.adapter.modifierContributionRequest(app);
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/modifier-contributions/modifier-contribution-worker.ts', {
        type: 'module'
      });
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      });
      worker.postMessage({ requestId: 17, request });
    });
  });
  expect(contributions.requestId).toBe(17);
  expect(contributions.contributions.length).toBeGreaterThan(0);
  expect(contributions.contributions[0].dpsIncrease).toBeGreaterThan(0);
  expect(await uiImports(await modifierWorkerReady)).toEqual([]);

  const randomWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('random-distribution-worker')
  );
  const random = await page.evaluate(() => {
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
  expect(random.requestId).toBe(1);
  expect(random.progress[0]).toBe(0);
  expect(random.progress.at(-1)).toBe(2);
  expect(random.distribution.trials).toBe(2);
  expect(random.distribution.mean).toBeGreaterThan(0);
  expect(random.distribution.samples).toHaveLength(2);
  expect(await uiImports(await randomWorkerReady)).toEqual([]);
});
