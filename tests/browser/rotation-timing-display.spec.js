import { expect, test } from '@playwright/test';

// A suppressed opening application must still guide marker placement in both the tooltip and pencil editor.
test('skill and Combat Start editors expose the scheduled target impact', async ({ page }) => {
  await page.goto('/necromancer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/necromancer/b-condi-reaper.json')).json();
    app.build = app.adapter.toApplicationBuild({ ...saved, rotation: ['Blood Is Power', '__combat_start'] });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const impactLabel = await page.evaluate(() => {
    const result = window.professionApp.results;
    const step = result.steps.find((candidate) => candidate.skill === 'Blood Is Power');
    const impact = result.events.find(
      (event) => event.activationId === step.activationId && event.type === 'condition'
    );
    return `First hit: ${Math.round(impact.at * 1000) - step.start} ms`;
  });
  const skill = page.locator('#rotation-timeline .rot-skill[data-idx="0"]');
  await expect(skill).toHaveAttribute('data-wiki-rotation', new RegExp(impactLabel));
  await skill.hover();
  await skill.locator('.rot-edit-activation').click();
  const editor = page.locator('.rotation-activation-editor:visible');
  await expect(editor.locator('.activation-editor-target-impact')).toHaveText(impactLabel);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  const markerEditor = page.locator('#rotation-timeline .rot-skill[data-idx="1"] .rot-edit-activation');
  await markerEditor.focus();
  await markerEditor.press('Enter');
  await expect(editor.locator('.activation-editor-target-impact')).toContainText('Blood Is Power');
  await expect(editor.locator('.activation-editor-target-impact')).toContainText(impactLabel);
});

// Display preferences and rotation actions must stay usable as the toolbar narrows.
test('rotation toolbar adapts display preferences and keeps load accessible', async ({ page }) => {
  // The toolbar is shared; one profession covers both sides of its wrap breakpoint.
  const profession = 'mesmer';
  await page.goto(`/${profession}.html`);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const width of [1440, 1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const toolbar = page.locator('.rotation-mid');
    const size = await toolbar.getByRole('combobox', { name: 'Timeline size', exact: true }).boundingBox();
    const display = await toolbar.getByRole('combobox', { name: 'Display', exact: true }).boundingBox();
    const sectionWidth = await page.locator('.rotation-section').evaluate((section) => section.clientWidth);
    if (sectionWidth <= 1050) {
      expect(display.y).toBeGreaterThanOrEqual(size.y + size.height);
    } else {
      expect(display.y).toBeLessThan(size.y + size.height);
      expect(display.y + display.height).toBeGreaterThan(size.y);
      expect(display.x).toBeGreaterThanOrEqual(size.x + size.width);
    }

    const load = toolbar.getByRole('button', { name: /Load Rotation/i });
    await load.click({ trial: true });
    const panel = await page.locator('.rotation-panel').boundingBox();
    const button = await load.boundingBox();
    expect(button.x).toBeGreaterThanOrEqual(panel.x);
    expect(button.x + button.width).toBeLessThanOrEqual(panel.x + panel.width);
  }
});

// Display preferences persist independently of timeline zoom and never trigger simulation changes.
test('timing display switches between classic and larger labels and survives reload', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const display = page.getByRole('combobox', { name: 'Display', exact: true });
  const size = page.getByRole('combobox', { name: 'Timeline size', exact: true });
  await expect(display).toHaveValue('classic');
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const time = page.locator('#rotation-timeline .rot-time').first();
  const classicFontSize = await time.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const revision = await page.evaluate(() => window.professionApp.buildRevision);
  await display.selectOption('timings');
  expect(await time.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(
    classicFontSize
  );
  const icon = page.locator('#rotation-timeline .rot-skill[data-idx] img').first();
  const bounds = await icon.boundingBox();
  expect(bounds.width).toBe(bounds.height);
  await size.selectOption('large');
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(revision);
  await page.reload();
  await expect(display).toHaveValue('timings');
  await expect(size).toHaveValue('large');
  expect(await time.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(
    classicFontSize
  );
  await display.selectOption('classic');
  expect(await time.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(classicFontSize);
  await expect(size).toHaveValue('large');
});
