import { expect, test } from '@playwright/test';

// Exercise the real button and bound handler; expansion-only tests cannot catch a permanently disabled macro tile.
test('Dodge + Auto is clickable and preserves the selected chain step and overlap', async ({ page }) => {
  await page.goto('/revenant.html#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const followupId = await page.evaluate(async () => {
    const app = window.professionApp;
    const build = await (await fetch('/data/gw2/builds/revenant/b-power-vindicator-greatsword-energy.json')).json();
    app.build = app.adapter.toApplicationBuild({
      ...build,
      startingWeaponSet: 1,
      rotation: [{ type: 'cast', skillId: 29057 }]
    });
    app.changed();
    return app.skillByName.get('Brutal Blade').id;
  });
  await page.waitForFunction(
    () =>
      window.professionApp.simulationStatus === 'idle' &&
      window.professionApp.resultRevision === window.professionApp.buildRevision
  );
  const macro = page.locator('#rotation-palette [data-skill="__vindicator_dodge_auto"]');
  await expect(macro).toBeVisible();
  await expect(macro).not.toHaveClass(/pal-context-disabled/);
  await macro.click();
  await page.waitForFunction(
    () =>
      window.professionApp.simulationStatus === 'idle' &&
      window.professionApp.resultRevision === window.professionApp.buildRevision
  );
  expect(await page.evaluate(() => window.professionApp.build.rotation.slice(-2))).toEqual([
    { type: 'cast', skillId: 23275 },
    { type: 'cast', skillId: followupId, concurrentOffsetMs: 0 }
  ]);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
});
