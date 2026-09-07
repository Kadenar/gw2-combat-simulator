import { expect, test } from '@playwright/test';

// Both panels keep independent conditional inputs while using the same displayed-stat calculation.
test('workspace and optimizer preview individual conditions, deltas and weapon changes without saving', async ({
  page
}) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const state = () =>
    page.evaluate(() =>
      JSON.stringify({
        build: window.professionApp.build,
        revision: window.professionApp.buildRevision,
        attributes: window.professionApp.attributeData
      })
    );
  const original = await state();
  const workspace = page.locator('#attributes-list');
  const base = await workspace.locator('.attr-current').allTextContents();
  await expect(workspace.locator('.attr-before')).toHaveCount(0);
  await workspace.getByRole('spinbutton', { name: 'Might', exact: true }).fill('25');
  await workspace.getByRole('checkbox', { name: 'Fury', exact: true }).check();
  await workspace.getByRole('spinbutton', { name: "Fencer's Finesse", exact: true }).fill('5');
  const buffed = await workspace.locator('.attr-current').allTextContents();
  expect(buffed).not.toEqual(base);
  await expect(
    workspace
      .locator('.attr-row')
      .filter({ hasText: /^Power/ })
      .locator('.attr-delta')
  ).toHaveText(' (+750)');
  await expect(
    workspace
      .locator('.attr-row')
      .filter({ hasText: /^Toughness/ })
      .locator('.attr-before')
  ).toHaveCount(0);
  expect(await state()).toBe(original);
  await page.locator('#attribute-weapon-set').selectOption('2');
  await expect(workspace.getByRole('spinbutton', { name: 'Might', exact: true })).toHaveValue('25');
  await page.locator('#attribute-weapon-set').selectOption('1');
  await workspace.screenshot({ path: '.scratch/optimizer/conditional-workspace.png' });

  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await panel.getByRole('row', { name: 'Equipped setup', exact: true }).click();
  const preview = panel.locator('[data-role="optimizer-preview"]');
  await expect(preview.getByRole('spinbutton', { name: 'Might', exact: true })).toHaveValue('0');
  const simulations = await page.evaluate(() => String(window.professionApp.gearOptimizerRunner.state.simulations));
  await preview.getByRole('spinbutton', { name: 'Might', exact: true }).fill('25');
  await preview.getByRole('checkbox', { name: 'Fury', exact: true }).check();
  await preview.getByRole('spinbutton', { name: "Fencer's Finesse", exact: true }).fill('5');
  expect(await preview.locator('.attr-current').allTextContents()).toEqual(buffed);
  await preview.getByRole('combobox', { name: 'Preview weapon set', exact: true }).selectOption('2');
  await expect(preview.getByRole('checkbox', { name: 'Fury', exact: true })).toBeChecked();
  await panel.getByRole('row', { name: 'Equipped setup', exact: true }).click();
  await expect(preview.getByRole('spinbutton', { name: "Fencer's Finesse", exact: true })).toHaveValue('5');
  expect(await state()).toBe(original);
  expect(await page.evaluate(() => String(window.professionApp.gearOptimizerRunner.state.simulations))).toBe(
    simulations
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await preview
    .getByRole('region', { name: 'Stats', exact: true })
    .screenshot({ path: '.scratch/optimizer/conditional-stats-mobile.png' });
});

// Use each profession's real page and trait catalog; only the fixture build setup bypasses unrelated editor controls.
for (const [profession, traitName, controlName, value] of [
  ['elementalist', 'Elemental Empowerment', 'Elemental Empowerment', '5'],
  ['engineer', 'Explosive Temper', 'Explosive Temper', '3'],
  ['guardian', 'Righteous Instincts', 'Resolution', null],
  ['mesmer', "Fencer's Finesse", "Fencer's Finesse", '5'],
  ['necromancer', 'Sand Sage', 'Sand Sage', null],
  ['necromancer', 'Death Perception', 'Shroud', null],
  ['ranger', 'Vicious Quarry', 'Fury', null],
  ['revenant', 'Brutal Momentum', 'Brutal Momentum', null],
  ['revenant', 'Roiling Mists', 'Fury', null],
  ['thief', 'Revealed Training', 'Revealed', null],
  ['warrior', 'Signet Mastery', 'Signet Mastery', '2']
]) {
  test(profession + ' previews ' + traitName, async ({ page }) => {
    await page.goto('/' + profession + '.html#workspace', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await page.evaluate((name) => {
      const app = window.professionApp;
      const trait = app.activeCatalog.traits.find((trait) => trait.name === name);
      const tier =
        typeof trait.tier === 'number'
          ? trait.tier
          : ['Major Adept', 'Major Master', 'Major Grandmaster'].indexOf(trait.tier) + 1;
      const choices = [0, 0, 0];
      if (trait.position > 0 && tier > 0) choices[tier - 1] = trait.position;
      app.build.specializations = [{ name: trait.specialization, traits: choices.join('-') }];
      if (app.adapter.id === 'elementalist') app.build.weapons = ['Hammer', ''];
      app.changed();
    }, traitName);
    await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
    const panel = page.locator('#attributes-list');
    const before = await page.evaluate(() => JSON.stringify(window.professionApp.build));
    const control = panel.getByRole(value === null ? 'checkbox' : 'spinbutton', { name: controlName, exact: true });
    if (value === null) await control.check();
    else await control.fill(value);
    expect(await panel.locator('.attr-changed').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(before);
    if (profession === 'elementalist') {
      await expect(control).toHaveAttribute('max', '10');
      const orb = panel.getByRole('checkbox', { name: 'Crescent Wind', exact: true });
      await orb.check();
      await control.fill('99');
      await control.blur();
      await expect(control).toHaveValue('10');
      await page.evaluate(() => {
        window.professionApp.build.weapons = ['Dagger', 'Focus'];
        window.professionApp.changed();
      });
      await expect(orb).toHaveCount(0);
    }

    if (value === null) await control.uncheck();
    else await control.fill('0');
    await expect(panel.locator('.attr-changed')).toHaveCount(0);
  });
}
