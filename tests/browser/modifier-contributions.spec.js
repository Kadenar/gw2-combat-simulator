import { expect, test } from '@playwright/test';

// Real panel geometry must keep long names and signed metrics readable without horizontal scrolling.
test('modifier contributions adapt to phone and narrow panel widths', async ({ page }) => {
  await page.route('http://127.0.0.1:4173/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
  );
  await page.goto('/');
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { modifierContributionsHtml } = await import('/js/games/gw2/app/results/analysis-panel.ts');
    document.body.innerHTML = '<main style="padding: 16px; width: 100%; min-width: 0"></main>';
    document.querySelector('main').innerHTML = modifierContributionsHtml({
      contributions: [
        {
          name: 'Superior Sigil of Force with a long modifier name',
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          dpsIncrease: 123456,
          pctIncrease: 123.45
        },
        { name: 'CompoundingPowerWithoutAnyWordBreaksInTheModifierName', dpsIncrease: -12345, pctIncrease: -12.34 }
      ]
    });
  });

  for (const width of [320, 390, 600, 900, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const stacked = width <= 600;
    const header = page.locator('.contrib-hdr');
    if (stacked) await expect(header).toBeHidden();
    else await expect(header).toBeVisible();

    for (const row of await page.locator('.contrib-row').all()) {
      const name = await row.locator('.contrib-name').boundingBox();
      const dps = await row.locator('.contrib-val').boundingBox();
      const percent = await row.locator('.contrib-pct').boundingBox();
      if (stacked) {
        expect(name.y + name.height).toBeLessThanOrEqual(dps.y);
        await expect(row.locator('.contrib-metric-label').first()).toBeVisible();
        await expect(row.locator('.contrib-metric-label').last()).toBeVisible();
      } else {
        expect(name.x + name.width).toBeLessThanOrEqual(dps.x);
        await expect(row.locator('.contrib-metric-label').first()).toBeHidden();
      }

      expect(dps.x + dps.width).toBeLessThanOrEqual(percent.x);
      expect(percent.x + percent.width).toBeLessThanOrEqual(width);
      expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(
        await row.locator('.contrib-name-label').evaluate((element) => element.scrollWidth <= element.clientWidth)
      ).toBe(true);
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.contrib-name img').evaluate((element) => element.getBoundingClientRect().width)).toBe(
      20
    );
  }

  // A narrow embedded panel needs the same layout even when the viewport itself is wide.
  await page.locator('main').evaluate((element) => {
    element.style.width = '400px';
  });
  await expect(page.locator('.contrib-hdr')).toBeHidden();
  await expect(page.locator('.contrib-metric-label').first()).toBeVisible();
});

// Analysis stays usable while modifiers run, and their completion preserves the existing interactive DOM.
test('modifiers run on demand in Analysis and update only their own section', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
  // Analysis publishes chart results asynchronously and may replace the skeleton between browser calls.
  await expect
    .poll(() => loadingScene.evaluate((element) => getComputedStyle(element, '::after').animationName))
    .toBe('chart-loading-sweep');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => loadingScene.evaluate((element) => getComputedStyle(element, '::after').animationName))
    .toBe('none');
  await expect.poll(() => loadingScene.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
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
