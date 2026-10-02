import { expect, test } from '@playwright/test';

// A denied maximum-charge command must still let the author select a valid smaller release through prefix previews.
test('palette opens Dragon Slash choices while its default command is denied', async ({ page }) => {
  await page.goto('/warrior.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json')).json();
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      initialResource: 20,
      rotation: ['Unsheathe Gunsaber', 'Dragon Trigger']
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(
    await page.evaluate(() => {
      const app = window.professionApp;
      const skill = app.skillByName.get('Dragon Slash—Force');
      return app.results.planningState.availability[skill.id].ready;
    })
  ).toBe(false);
  const tile = page.locator('#rotation-palette [data-skill="Dragon Slash—Force"]');
  await expect(tile).not.toHaveClass(/pal-context-disabled/);
  await tile.click();
  const editor = page.getByRole('dialog', { name: 'Edit Dragon Slash—Force charge release', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('radio', { name: /^1 charges/ }).check();
  // Palette insertion carries the independent hold alongside the unchanged charge selection.
  await editor.getByRole('spinbutton', { name: 'Additional release delay (ms)' }).fill('80');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBe(1);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseDelayMs)).toBe(80);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
});

// The pencil is the sole release control, and its selection survives simulation and reopening.
test('Dragon Slash pencil edits charge release instead of generic cast behavior', async ({ page }) => {
  await page.goto('/warrior.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json')).json();
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      // Fund Dragon Trigger entry and its release choices independently of the saved preset's opener.
      initialResource: 100,
      rotation: ['Unsheathe Gunsaber', 'Dragon Trigger', 'Dragon Slash—Force']
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);

  const pencil = page.getByRole('button', { name: 'Edit Dragon Slash—Force charge release', exact: true });
  await pencil.focus();
  await pencil.press('Enter');
  const editor = page.getByRole('dialog', { name: 'Edit Dragon Slash—Force charge release', exact: true });
  await expect(editor).toBeVisible();
  await expect(page.locator('.rotation-activation-editor:visible')).toHaveCount(0);
  await expect(editor.getByRole('radio', { name: 'Release at maximum', exact: true })).toBeChecked();
  await editor.getByRole('radio', { name: /^1 charges/ }).check();
  const delay = editor.getByRole('spinbutton', { name: 'Additional release delay (ms)' });
  await expect(delay).toHaveValue('0');
  await delay.fill('41');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(editor).toBeVisible();
  await delay.fill('120');
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
  await expect(delay).toHaveValue('120');
  // Cancelling a cleared hold preserves it; applying a blank removes the optional saved field.
  await delay.fill('');
  await editor.getByRole('radio', { name: 'Release at maximum', exact: true }).check();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBe(1);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseDelayMs)).toBe(120);
  await page.locator('#rotation-timeline .rot-skill').filter({ has: pencil }).hover();
  await pencil.click();
  await editor.getByRole('radio', { name: 'Release at maximum', exact: true }).check();
  await delay.fill('');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseAtCharges)).toBeUndefined();
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).releaseDelayMs)).toBeUndefined();
});
