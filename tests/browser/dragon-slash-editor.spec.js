import { expect, test } from '@playwright/test';

// The pencil is the sole release control, and its selection survives simulation and reopening.
test('Dragon Slash pencil edits charge release instead of generic cast behavior', async ({ page }) => {
  await page.goto('/warrior.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json')).json();
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      rotation: ['Unsheathe Gunsaber', 'Dragon Trigger', 'Dragon Slash—Force']
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const pencil = page.getByRole('button', { name: 'Edit Dragon Slash—Force charge release', exact: true });
  await pencil.focus();
  await pencil.press('Enter');
  const editor = page.getByRole('dialog', { name: 'Edit Dragon Slash—Force charge release', exact: true });
  await expect(editor).toBeVisible();
  await expect(page.locator('.rotation-activation-editor:visible')).toHaveCount(0);
  await expect(editor.getByRole('radio', { name: 'Release at maximum', exact: true })).toBeChecked();
  await editor.getByRole('radio', { name: /^1 charges/ }).check();
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBe(1);

  const badge = page.locator('#rotation-timeline .rot-charge-release-badge');
  expect(
    await badge.evaluate((element) => element.onclick === null && getComputedStyle(element).pointerEvents === 'none')
  ).toBe(true);
  await page.locator('#rotation-timeline .rot-skill').filter({ has: pencil }).hover();
  await pencil.click();
  await expect(editor.getByRole('radio', { name: /^1 charges/ })).toBeChecked();
  await editor.getByRole('radio', { name: 'Release at maximum', exact: true }).check();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBe(1);
  await page.locator('#rotation-timeline .rot-skill').filter({ has: pencil }).hover();
  await pencil.click();
  await editor.getByRole('radio', { name: 'Release at maximum', exact: true }).check();
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBeUndefined();
});
