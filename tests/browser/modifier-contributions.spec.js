import { expect, test } from '@playwright/test';

// Prepared modifier jobs must complete without importing browser adapters, editors, or result views.
test('modifier workers calculate contributions without loading UI dependencies', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const workerReady = page.waitForEvent('worker', (worker) => worker.url().includes('modifier-contribution-worker'));
  const result = await page.evaluate(() => {
    const app = window.professionApp;
    app.modifierContributionRunner.cancel();
    const request = app.adapter.modifierContributionRequest(app);
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/modifiers/modifier-contribution-worker.ts', {
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
  expect(result.requestId).toBe(17);
  expect(result.contributions.length).toBeGreaterThan(0);
  expect(result.contributions[0].dpsIncrease).toBeGreaterThan(0);

  const worker = await workerReady;
  const uiImports = await worker.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\/app\/(?:create-adapter\.|build-editor\.|build\/|rotation\/|results\/)/.test(url))
  );
  expect(uiImports).toEqual([]);
});
