import { expect, test } from '@playwright/test';

// Analysis stays usable while modifiers run, and their completion preserves the existing interactive DOM.
test('modifiers run on demand in Analysis and update only their own section', async ({ page }) => {
  const modifierWorkers = [];
  page.on('worker', (worker) => {
    if (worker.url().includes('modifier-contribution-worker')) modifierWorkers.push(worker);
  });
  await page.goto('/mesmer.html#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  // Observe beyond the existing debounce to catch any hidden Workspace scheduling.
  await page.waitForTimeout(850);
  expect(modifierWorkers).toHaveLength(0);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);

  // Hold the existing RNG priority gate so pending-state interaction is deterministic.
  await page.evaluate(() => {
    Object.defineProperty(window.professionApp.randomDistributionRunner, 'isRunning', {
      configurable: true,
      value: true
    });
  });
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const pending = page.locator('[data-role="modifier-contributions"] [role="status"]');
  await expect(pending).toHaveText('Calculating modifier contributions…');
  await expect(page.locator('[data-role="result-charts"]')).toBeVisible();
  await page.locator('[data-role="skill-header"] [data-sort-col="total"]').click();
  expect(await page.evaluate(() => window.professionApp._skillSortCol)).toBe('total');
  const chart = await page.locator('[data-role="result-charts"]').elementHandle();
  const rows = await page.locator('[data-role="skill-rows"]').elementHandle();
  await page.evaluate(() => {
    delete window.professionApp.randomDistributionRunner.isRunning;
  });
  await expect(page.locator('.contrib-row').first()).toBeVisible();
  await expect(pending).toHaveCount(0);
  expect(modifierWorkers.length).toBeGreaterThan(0);
  expect(await chart.evaluate((element) => element.isConnected)).toBe(true);
  expect(await rows.evaluate((element) => element.isConnected)).toBe(true);

  const completedWorkerCount = modifierWorkers.length;
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.modifierContributionRunner.isRunning)).toBe(false);
  expect(modifierWorkers).toHaveLength(completedWorkerCount);

  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  await expect(pending).toBeVisible();
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.modifierContributionRunner.isRunning)).toBe(false);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);
});
