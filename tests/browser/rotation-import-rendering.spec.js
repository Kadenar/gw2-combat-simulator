import { expect, test } from '@playwright/test';

// Native file input and manifest selection resolve unique authored names to the same identity at each destination.
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
  const zeroDelays = { weaponSwapMs: 0, forgeEntryMs: 0, forgeExitMs: 0, shroudEntryMs: 0, shroudExitMs: 0 };
  await page.route('**/bug-002-rotation.json*', (route) =>
    route.fulfill({
      json: { rotation: ['Bladesong Harmony'], transitionDelays: zeroDelays }
    })
  );
  await page.locator('#btn-import-rotation').click();
  const current = page.locator('.rotation-import-dialog[data-rotation-import-destination="current"]');
  await current.getByRole('tab', { name: 'Upload file', exact: true }).click();
  await page.locator('#rotation-file-input').setInputFiles({
    name: 'rotation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...build,
        rotation: ['Bladesong Harmony'],
        transitionDelays: { ...zeroDelays, weaponSwapMs: 150 }
      })
    )
  });
  await current.getByRole('button', { name: 'Review import', exact: true }).click();
  await expect(current.getByRole('button', { name: 'Apply rotation', exact: true })).toBeEnabled();
  await expect(current.getByRole('list', { name: 'Import notices' })).toContainText('every profession');
  await expect(current.getByRole('list', { name: 'Import notices' })).toContainText('Rotation Undo does not revert');
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(0);
  await current.getByRole('button', { name: 'Apply rotation', exact: true }).click();
  await expect(current).toBeHidden();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(150);
  expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'cast', skillId: 62617 }]);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.locator('[data-comparison-empty-load]').click();
  const reference = page.locator('.rotation-import-dialog[data-rotation-import-destination="reference"]');
  await reference.getByRole('tab', { name: 'Saved rotation', exact: true }).click();
  const presets = reference.getByRole('combobox', { name: 'Compatible rotation', exact: true });
  await expect(presets).toBeEnabled();
  await presets.selectOption({ label: 'Named rotation' });
  await expect(reference.getByRole('button', { name: 'Use as reference', exact: true })).toBeEnabled();
  await expect(reference.getByRole('list', { name: 'Import notices' })).toContainText('weapon swap 0 ms');
  await reference.getByRole('button', { name: 'Use as reference', exact: true }).click();
  await expect(reference).toBeHidden();
  await page.waitForFunction(() => window.professionApp.rotationComparison?.referenceStatus === 'fresh');
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(0);
  expect(await page.evaluate(() => window.professionApp.rotationComparison.referenceRotation)).toEqual([
    { type: 'cast', skillId: 62617 }
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
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toContainEqual({
    message: `${skillId}: ${reason}`,
    at: 0,
    rotationIndex: 0
  });

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
