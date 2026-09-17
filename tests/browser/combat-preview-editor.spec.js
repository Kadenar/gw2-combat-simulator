import { expect, test } from '@playwright/test';

// Exercise the visible opt-in flow with real workers; use a short authored sequence after the reference load.
test('Guardian preview loads, edits, rejects unsupported inputs, saves, and rolls back to legacy', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.selectOption('#combat-engine-select', 'preview');
  await expect(page.locator('#combat-preview-scope')).toBeVisible();
  await page.getByRole('button', { name: 'Load Willbender reference' }).click();
  await page.waitForFunction(() => window.professionApp.results?.engine === 'preview', null, { timeout: 45_000 });
  await expect(page.locator('#combat-engine-status')).toContainText('New engine preview result');
  await expect(page.locator('[data-rotation-compare]')).toBeDisabled();
  await expect(page.locator('[data-skill="__cooldown_reset"]')).toHaveClass(/pal-context-disabled/);
  await page.locator('#btn-sim-clear').click();
  await page.waitForFunction(() => window.professionApp.prefixSimulationRunner.current()?.insertionIndex === 0);
  const tile = page.locator('#rotation-palette [data-skill-id="72031"]:not(.pal-context-disabled)').first();
  await expect(tile).not.toHaveClass(/pal-context-disabled/);
  await tile.click();
  await page.waitForFunction(
    () =>
      window.professionApp.results?.engine === 'preview' &&
      window.professionApp.resultRevision === window.professionApp.buildRevision
  );
  await page.locator('a[href$="#analysis"]').click();
  await expect(page.locator('#rotation-results')).toContainText('Through the Heart');
  await expect(page.locator('#rotation-results')).toContainText('unavailable in the new engine preview');
  await page.locator('a[href$="#gear-optimizer"]').click();
  await expect(page.getByRole('button', { name: 'Run optimizer', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Compare relics', exact: true })).toBeDisabled();
  await page.locator('a[href$="#workspace"]').click();
  const previous = await page.evaluate(() => {
    const app = window.professionApp;
    const rune = app.build.rune;
    app.build.rune = 'Trapper';
    app.changed();
    return { rune, cleared: app.results === null };
  });
  expect(previous.cleared).toBe(true);
  await expect(page.locator('#combat-engine-status')).toContainText('build.rune');
  await page.evaluate((rune) => {
    const app = window.professionApp;
    app.build.rune = rune;
    app.changed();
  }, previous.rune);
  await page.waitForFunction(() => window.professionApp.results?.engine === 'preview');
  const before = await page.evaluate(() => JSON.stringify(window.professionApp.build));
  await page.selectOption('#combat-engine-select', 'legacy');
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(before);
  expect(await page.evaluate(() => Boolean(window.professionApp.results?.schedulerState))).toBe(true);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(before);
  await page.selectOption('#combat-engine-select', 'preview');
  await page.waitForFunction(() => window.professionApp.results?.engine === 'preview');
  expect(errors).toEqual([]);
});

test('unavailable preview workers show an error and allow an explicit legacy fallback', async ({ page }) => {
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    window.Worker = undefined;
  });
  await page.selectOption('#combat-engine-select', 'preview');
  await expect(page.locator('#combat-engine-status')).toContainText('requires Web Workers');
  expect(await page.evaluate(() => window.professionApp.results)).toBe(null);
  await page.selectOption('#combat-engine-select', 'legacy');
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => Boolean(window.professionApp.results?.schedulerState))).toBe(true);
});
