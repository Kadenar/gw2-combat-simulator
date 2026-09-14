import { expect, test } from '@playwright/test';

// Overlay choices persist without editing the rotation or rerunning its simulation.
test('King of Fires overlays are opt-in, persisted, and limited to Berserker', async ({ page }) => {
  await page.goto('/warrior.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await fetch('/data/gw2/builds/warrior/b-condi-berserker-longbow-sword-torch.json').then((response) =>
      response.json()
    );
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      startingWeaponSet: 1,
      rotation: ['__combat_start', 'Berserk', 'Scorched Earth', { type: 'wait', durationMs: 3000 }]
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.resultRevision === window.professionApp.buildRevision);
  expect(
    await page.evaluate(() => window.professionApp.results.procSteps.some((proc) => proc.skill === 'King of Fires'))
  ).toBe(true);
  const original = await page.evaluate(() => ({
    rotation: window.professionApp.build.rotation,
    revision: window.professionApp.buildRevision
  }));
  const markers = page.locator('#rotation-timeline .rot-proc-overlay[data-proc-key="trait_proc:King of Fires"]');
  await expect(markers).toHaveCount(0);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  const checkbox = page.getByLabel('Overlay King of Fires', { exact: true });
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByLabel('Overlay Sovereign of Light')).toHaveCount(0);
  await checkbox.check();
  await expect(markers.first()).toBeVisible();
  await expect(markers.first()).toHaveAttribute('title', /Triggered by Scorched Earth/);
  expect(
    await page.evaluate(() => ({
      rotation: window.professionApp.build.rotation,
      revision: window.professionApp.buildRevision
    }))
  ).toEqual(original);

  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  await expect(checkbox).toBeChecked();
  await expect(markers.first()).toBeVisible();
  await checkbox.uncheck();
  await expect(markers).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('gw2-rotation-overlay-king-of-fires-procs'))).toBe('false');

  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.specializations = app.build.specializations.filter((selection) => selection.name !== 'Berserker');
    app.changed();
  });
  await expect(checkbox).toHaveCount(0);
});
