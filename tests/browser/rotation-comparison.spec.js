import { expect, test } from '@playwright/test';

// Cursor changes refresh both comparison previews without mutating rotations or invalidating simulation results.
test('insertion selection and clearing refresh comparison after timeline rerenders', async ({ page }) => {
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
  const damage = page.locator('[data-comparison-current-damage]');
  const finalDamage = await damage.textContent();
  const simulationState = () =>
    page.evaluate(() => {
      const app = window.professionApp;
      return {
        rotation: app.build.rotation,
        reference: app.rotationComparison.referenceRotation,
        buildRevision: app.buildRevision,
        resultRevision: app.resultRevision,
        simulationStatus: app.simulationStatus
      };
    });
  const before = await simulationState();

  await current.locator('.rot-insertion-gap[data-insertion-index="0"]').click();
  await expect(damage).not.toHaveText(finalDamage);
  await expect(current.locator('.rot-skill[data-idx="0"]')).toHaveClass(/rot-preview-active/);
  await expect(reference.locator('.rot-skill[data-idx="0"]')).toHaveClass(/rot-preview-active/);
  await expect(reference.locator('.rot-insertion-gap')).toHaveCount(0);

  // A direct timeline refresh must retain the controller callback for subsequent native cursor interactions.
  await page.evaluate(async () => {
    const { renderTimeline } = await import('/js/games/gw2/app/rotation/timeline/view.ts');
    renderTimeline(window.professionApp);
  });
  await current.locator('.rot-insertion-gap[data-insertion-index="1"]').click();
  await expect(current.locator('.rot-insertion-gap[data-insertion-index="1"]')).toHaveClass(/active/);
  await expect(reference.locator('.rot-preview-active')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(damage).toHaveText(finalDamage);
  await expect(current.locator('.rot-preview-active')).toHaveCount(0);
  await expect(reference.locator('.rot-preview-active')).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.rotationInsertionIndex)).toBeNull();
  expect(await simulationState()).toEqual(before);
});

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
