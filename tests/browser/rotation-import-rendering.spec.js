import { expect, test } from '@playwright/test';

// Imported unknown commands must retain their diagnostics as text in editable and reference timelines.
test('unknown imported skill diagnostics cannot create timeline attributes or elements', async ({ page }) => {
  const skillId = 'audit" data-audit-marker="present"><audit-marker>&quoted';
  const reason = `Unknown skill id ${skillId}.`;
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp?.simulationStatus === 'idle');
  await page.evaluate(async (skillId) => {
    const { previewRotationFile, applyRotationImportPreview } =
      await import('/js/games/gw2/app/build/io/rotation-import-dialog.ts');
    const file = new File([JSON.stringify([{ type: 'cast', skillId }])], 'rotation.json', {
      type: 'application/json'
    });
    const app = window.professionApp;
    applyRotationImportPreview(app, await previewRotationFile(file, app));
  }, skillId);
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toContain(reason);

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
