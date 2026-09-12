import { expect, test } from '@playwright/test';

// Real controls must survive build switches, imports, reloads, and navigation to another profession.
test('transition delay preferences are global and imported waits overlap them', async ({ page }) => {
  const warnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  const settings = page.locator('#simulation-transition-delays');
  await expect(settings.getByRole('spinbutton')).toHaveCount(5);
  await settings.getByRole('button', { name: 'Apply 100 ms to all' }).click();
  await expect(page.locator('#simulation-weaponSwapMs')).toHaveValue('100');
  await page.evaluate(async () => {
    const { previewRotationFile, applyRotationImportPreview } =
      await import('/js/games/gw2/app/build/io/rotation-import-dialog.ts');
    const app = window.professionApp;
    const rotation = ['Swap Weapons', { name: '__wait', waitMs: 80 }, 'Swap Weapons'];
    const file = new File([JSON.stringify(rotation)], 'rotation.json', { type: 'application/json' });
    applyRotationImportPreview(app, await previewRotationFile(file, app));
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const timing = await page.evaluate(() => {
    const app = window.professionApp;
    return {
      starts: app.results.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
      warnings: app.results.warnings,
      buildHasSettings: JSON.stringify(app.build).includes('transitionDelays'),
      settings: app.simulationSettings.transitionDelays
    };
  });
  expect(timing.starts).toEqual([0, 100]);
  expect(timing.warnings).toEqual([]);
  expect(timing.buildHasSettings).toBe(false);
  expect(Object.values(timing.settings)).toEqual([100, 100, 100, 100, 100]);
  const forced = page.locator('#rotation-timeline .rot-forced-delay');
  await expect(forced).toHaveCount(2);
  await expect(forced.first()).toHaveAttribute('title', /Forced transition delay: 20 ms/);
  await expect(forced.first()).toBeVisible();
  expect(await forced.first().evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe('solid');
  const revision = await page.evaluate(() => window.professionApp.buildRevision);
  await page.getByRole('checkbox', { name: 'Display transition delays', exact: true }).uncheck();
  await expect(forced.first()).toBeHidden();
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(revision);
  // Switch through the real workspace path without relying on the config panel's overlay position.
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    const app = window.professionApp;
    addBuildTab(app);
  });
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(100);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(100);
  expect(await page.locator('html').getAttribute('data-show-transition-delays')).toBe('false');
  await page.goto('/guardian.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.forgeEntryMs)).toBe(100);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  await settings.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await settings.getByRole('spinbutton').evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual([
    '0',
    '0',
    '0',
    '0',
    '0'
  ]);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => Object.values(window.professionApp.simulationSettings.transitionDelays))).toEqual([
    0, 0, 0, 0, 0
  ]);
  expect(warnings.filter((message) => message.includes('UNPRESENTED CUSTOM EVENT'))).toEqual([]);
});
