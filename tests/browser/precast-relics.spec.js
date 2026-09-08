import { expect, test } from '@playwright/test';

// The gear selector saves independent preparation choices and actual precombat casts produce their buffs.
test('gear panel adds, removes and restores precast relics', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.relic = '';
    app.build.precastRelics = [];
    app.build.weapons = ['Sword', 'Sword'];
    app.build.startingWeaponSet = 1;
    app.build.selectedSkills.Heal = 'Ether Feast';
    app.build.selectedSkills.Elite = 'Mass Invisibility';
    app.build.targetHealth = 0;
    const cast = (name) => ({ type: 'cast', skillId: app.skillByName.get(name).id });
    app.build.rotation = [
      cast('Mass Invisibility'),
      cast('Ether Feast'),
      { type: 'wait', durationMs: 1000 },
      { type: 'combat-start' },
      cast('Mind Slash'),
      { type: 'wait', durationMs: 8000 }
    ];
    app.changed();
  });
  const ready = () =>
    page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await ready();
  const picker = page.locator('.gear-panel #precast-relics');
  await expect(picker).toBeVisible();
  await expect(picker.locator('.optimizer-picker-empty')).toHaveText('No precast relics');
  const select = picker.getByRole('combobox', { name: 'Add precast relics' });
  await select.selectOption({ label: await select.locator('option[data-choice="Mount Balrior"]').textContent() });
  await select.selectOption({ label: await select.locator('option[data-choice="Director"]').textContent() });
  await ready();
  await expect(picker.locator('.optimizer-choice')).toHaveCount(2);
  await expect(select.locator('option[data-choice="Director"]')).toBeDisabled();
  expect(await page.evaluate(() => window.professionApp.build.relic)).toBe('');
  const procs = await page.evaluate(() =>
    window.professionApp.results.procSteps.filter((step) => step.type === 'relic_proc').map((step) => step.skill)
  );
  expect(procs).toContain('Relic of the Director');
  expect(procs).toContain('Relic of Mount Balrior');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await ready();
  await expect(picker.locator('.optimizer-choice')).toHaveCount(2);
  await picker.getByRole('button', { name: 'Remove Director from precastRelics' }).click();
  await ready();
  await expect(picker.locator('.optimizer-choice')).toHaveCount(1);
  await expect(select.locator('option[data-choice="Director"]')).toBeEnabled();
  expect(await page.evaluate(() => window.professionApp.build.precastRelics)).toEqual(['Mount Balrior']);
  expect(
    await page.evaluate(() =>
      window.professionApp.results.procSteps.some((step) => step.skill === 'Relic of the Director')
    )
  ).toBe(false);
});
