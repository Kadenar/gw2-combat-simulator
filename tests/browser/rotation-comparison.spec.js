import { expect, test } from '@playwright/test';

// Reference highlighting stays local, survives rendering, and never edits either rotation.
test('reference skills toggle matching highlights independently of the current rotation', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    const skill = app.build.rotation[0];
    app.build.rotation = [skill, { type: 'wait', durationMs: 1000 }, { ...skill }];
    app.changed(false);
  });
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();

  const current = page.locator('#rotation-timeline');
  const reference = page.locator('#rotation-reference-timeline');
  const referenceSkill = reference.locator('.rot-skill[data-idx="0"]');
  await current.locator('.rot-skill[data-idx="1"] img').click();
  const state = () =>
    page.evaluate(() => {
      const app = window.professionApp;
      return {
        current: app.build.rotation,
        reference: app.rotationComparison.referenceRotation,
        buildRevision: app.buildRevision,
        resultRevision: app.resultRevision,
        insertionIndex: app.rotationInsertionIndex,
        highlight: app.rotationSkillHighlightKey
      };
    });
  const before = await state();

  await referenceSkill.click();
  await expect(reference.locator('.skill-highlight')).toHaveCount(2);
  await expect(reference.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-faded/);
  await expect(current.locator('.skill-highlight')).toHaveCount(1);
  await expect(current.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-highlight/);
  await expect(reference.locator('[draggable="true"], .rot-x, .rot-edit-activation, .rot-edit-wait')).toHaveCount(0);

  await page.evaluate(() => window.professionApp.adapter.renderRotationBuilder(window.professionApp));
  await expect(reference.locator('.skill-highlight')).toHaveCount(2);
  await expect(current.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-highlight/);
  await referenceSkill.click();
  await expect(reference.locator('.skill-highlight, .skill-faded')).toHaveCount(0);
  expect(await state()).toEqual(before);

  await referenceSkill.click();
  await page.locator('[data-comparison-reference-clear]').click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();
  await expect(reference.locator('.skill-highlight, .skill-faded')).toHaveCount(0);
});
