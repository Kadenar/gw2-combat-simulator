import { expect, test } from '@playwright/test';

// Analysis stays usable while modifiers run, and their completion preserves the existing interactive DOM.
test('modifiers run on demand in Analysis and update only their own section', async ({ page }) => {
  const modifierWorkers = [];
  page.on('worker', (worker) => {
    if (worker.url().includes('/simulation/modifier-contributions/worker.')) modifierWorkers.push(worker);
  });
  await page.goto('/mesmer.html#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  // Observe beyond the existing debounce to catch any hidden Workspace scheduling.
  await page.waitForTimeout(850);
  expect(modifierWorkers).toHaveLength(0);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);
  // Editor baselines retain APM and live planning state without collecting chart histories.
  const editor = await page.evaluate(() => {
    const result = window.professionApp.results;
    return { dps: result.dps, apm: result.rotationApm, effects: result.effectReport, boons: result.boonGeneration };
  });
  expect(editor.effects).toBeNull();
  expect(editor.boons).toBeNull();
  expect(editor.apm).toBeDefined();

  // Hold the existing RNG priority gate so pending-state interaction is deterministic.
  await page.evaluate(() => {
    Object.defineProperty(window.professionApp.randomDistributionRunner, 'isRunning', {
      configurable: true,
      value: true
    });
  });
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const pending = page.locator('[data-role="modifier-contributions"] [role="status"]');
  await expect(pending).toHaveAccessibleName('Calculating modifier contributions');
  // The shared chart shimmer must respect reduced motion while retaining the loading announcement.
  const loadingScene = pending.locator('.contrib-loading-skeleton');
  await expect(loadingScene).toBeVisible();
  await expect(loadingScene).toHaveAttribute('aria-hidden', 'true');
  expect(await loadingScene.evaluate((element) => getComputedStyle(element, '::after').animationName)).toBe(
    'chart-loading-sweep'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await loadingScene.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(pending).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-role="result-charts"]')).toBeVisible();
  expect(await page.evaluate(() => window.professionApp.results.dps)).toBe(editor.dps);
  expect(await page.evaluate(() => window.professionApp.results.rotationApm)).toEqual(editor.apm);
  expect(
    await page.evaluate(() =>
      Boolean(window.professionApp.results.effectReport && window.professionApp.results.boonGeneration)
    )
  ).toBe(true);
  const chartRequestId = await page.evaluate(() => window.professionApp.baselineSimulationRunner.requestId);
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
  expect(await page.evaluate(() => window.professionApp.baselineSimulationRunner.requestId)).toBe(chartRequestId);

  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);
  expect(await page.evaluate(() => window.professionApp.results.effectReport)).toBeNull();
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  await expect(pending).toBeVisible();
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.modifierContributionRunner.isRunning)).toBe(false);
  expect(await page.evaluate(() => window.professionApp.results.modifierContributionsStale)).toBe(true);
});
