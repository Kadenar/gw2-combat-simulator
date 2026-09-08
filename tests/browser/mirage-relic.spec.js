import { expect, test } from '@playwright/test';

// Rotation dodges drive Mirage in the baseline and comparison without interval settings.
test('Mirage rotation dodges and relic damage contributions work in the application', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/mesmer/b-power-mirage-spear-greatsword.json')).json();
    app.build = app.adapter.toApplicationBuild(saved);
    app.build.relic = 'Mirage';
    app.build.targetHealth = 0;
    app.build.rotation = [
      { type: 'cast', skillId: -1 },
      { type: 'wait', durationMs: 10000 }
    ];
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await expect(page.locator('#mirage-evade-interval')).toHaveCount(0);
  await page.evaluate(() => window.professionApp.runRelicComparison('Thorns', 4));
  await page.waitForFunction(() => !!window.professionApp.results.relicComparison);
  const summary = await page.evaluate(() => window.professionApp.results.relicComparison);
  expect(summary.opponentDamage.directDamage).toBeGreaterThan(0);
  expect(summary.targetDamage.directDamage).toBe(0);
  expect(summary.targetDamage.contributedDps).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  await expect(page.locator('.relic-cmp-damage')).toContainText('Mirage (standard)');
  await expect(page.locator('.relic-cmp-damage')).toContainText('Direct relic damage');
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.relic = 'Thorns';
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await page.getByRole('combobox', { name: 'Comparison relic' }).selectOption('Mirage');
  await expect(page.locator('[data-role="relic-comparison-evades"]')).toHaveCount(0);
  await page.locator('[data-role="relic-comparison-run"]').click();
  await page.waitForFunction(() => window.professionApp.results.relicComparison?.targetRelic === 'Mirage');
  expect(
    await page.evaluate(() => window.professionApp.results.relicComparison.targetDamage.directDamage)
  ).toBeGreaterThan(0);
});
