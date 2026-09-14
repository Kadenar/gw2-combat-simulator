import { expect, test } from '@playwright/test';

// Exercise the real worker and workspace persistence instead of merely asserting generated input markup.
test('proc controls rerun the build, survive reload, reset, and follow selected traits', async ({ page }) => {
  await page.goto('/necromancer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await fetch('/data/gw2/builds/necromancer/b-condi-harbinger.json').then((response) =>
      response.json()
    );
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      rotation: ['Blood Is Power', { type: 'wait', durationMs: 6000 }]
    });
    app.changed();
  });
  const settled = () =>
    page.waitForFunction(() => window.professionApp.resultRevision === window.professionApp.buildRevision);
  await settled();
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  const input = page.locator('[data-proc-rate-id="necromancer.barbed-precision"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('placeholder', /^\d+(?:\.\d+)?%$/);
  await input.fill('100');
  await input.press('Tab');
  await settled();
  const high = await page.evaluate(() => window.professionApp.results.totalDamage);
  await page.getByRole('button', { name: 'Close simulation config', exact: true }).click();
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const procHits = page.locator(
    '[data-skill-key="Player|Barbed Precision"] [title="Proc activations, excluding condition ticks and stack counts."]'
  );
  await expect(procHits).toBeVisible();
  await expect(procHits).toHaveText('1');
  await page.locator('.simulator-view-tab[data-simulator-view="workspace"]').click();
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  await input.fill('0');
  await input.press('Tab');
  await settled();
  expect(await page.evaluate(() => window.professionApp.results.totalDamage)).toBeLessThan(high);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  await expect(input).toHaveValue('0');
  await page.getByRole('button', { name: 'Reset Barbed Precision proc rate' }).click();
  await expect(input).toHaveValue('');
  expect(await page.evaluate(() => window.professionApp.build.assumptions.procRateOverrides)).toEqual({});
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.specializations = app.build.specializations.filter((selection) => selection.name !== 'Curses');
    app.changed();
  });
  await expect(input).toHaveCount(0);
});
