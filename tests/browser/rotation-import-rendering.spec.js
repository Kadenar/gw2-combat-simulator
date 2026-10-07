import { expect, test } from '@playwright/test';

// Native file input and manifest selection must deliver the same specialization-aware preview to each destination.
test('named rotations import through the Current file dialog and Reference manifest dialog', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp?.simulationStatus === 'idle');
  const build = await page.evaluate(() => {
    const app = window.professionApp;
    app.templatePresets = [
      { label: 'Named rotation', build: '/bug-002-build.json', rotation: '/bug-002-rotation.json' }
    ];
    return app.build;
  });
  await page.route('**/bug-002-build.json*', (route) => route.fulfill({ json: build }));
  await page.route('**/bug-002-rotation.json*', (route) => route.fulfill({ json: ['Bladecall'] }));
  await page.locator('#btn-import-rotation').click();
  const current = page.locator('.rotation-import-dialog[data-rotation-import-destination="current"]');
  await page.locator('#rotation-file-input').setInputFiles({
    name: 'rotation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(['Bladecall']))
  });
  await expect(current.getByRole('button', { name: 'Apply rotation', exact: true })).toBeEnabled();
  await current.getByRole('button', { name: 'Apply rotation', exact: true }).click();
  await expect(current).toBeHidden();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'cast', skillId: 69311 }]);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.locator('[data-comparison-empty-load]').click();
  const reference = page.locator('.rotation-import-dialog[data-rotation-import-destination="reference"]');
  const presets = reference.getByRole('combobox', { name: 'Existing rotation', exact: true });
  await expect(presets).toBeEnabled();
  await presets.selectOption({ label: 'Named rotation' });
  await reference.getByRole('button', { name: 'Load selected', exact: true }).click();
  await expect(reference.getByRole('button', { name: 'Use as reference', exact: true })).toBeEnabled();
  await reference.getByRole('button', { name: 'Use as reference', exact: true }).click();
  await expect(reference).toBeHidden();
  await page.waitForFunction(() => window.professionApp.rotationComparison?.referenceStatus === 'fresh');
  expect(await page.evaluate(() => window.professionApp.rotationComparison.referenceRotation)).toEqual([
    { type: 'cast', skillId: 69311 }
  ]);
});

// Imported unknown commands must retain their diagnostics as text in editable and reference timelines.
test('unknown imported skill diagnostics cannot create timeline attributes or elements', async ({ page }) => {
  const skillId = 'audit" data-audit-marker="present"><audit-marker>&quoted';
  const reason = 'Unknown skill.';
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp?.simulationStatus === 'idle');
  await page.evaluate(async (skillId) => {
    const { previewRotationFile, applyRotationImportPreview } =
      await import('/js/games/gw2/app/import-export/rotation-import-dialog.ts');
    const file = new File([JSON.stringify([{ type: 'cast', skillId }])], 'rotation.json', {
      type: 'application/json'
    });
    const app = window.professionApp;
    applyRotationImportPreview(app, await previewRotationFile(file, app));
  }, skillId);
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toContain(`${skillId}: ${reason}`);

  await page.evaluate(async () => {
    const { renderTimeline } = await import('/js/games/gw2/app/rotation/timeline/view.ts');
    const root = document.createElement('div');
    root.id = 'audit-reference-timeline';
    document.body.append(root);
    const app = window.professionApp;
    renderTimeline(app, { root, procRoot: null, build: app.build, result: app.results, readOnly: true });
  });
  for (const selector of ['#rotation-timeline', '#audit-reference-timeline']) {
    const timeline = page.locator(selector);
    await expect(timeline.locator('.rot-invalid')).toHaveAttribute('title', `${skillId}\n${reason}`);
    await expect(timeline.locator('[data-audit-marker], audit-marker')).toHaveCount(0);
  }
});
