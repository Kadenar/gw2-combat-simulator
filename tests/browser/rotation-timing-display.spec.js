import { expect, test } from '@playwright/test';

// Display preferences and rotation actions must stay usable as the toolbar narrows.
test('rotation toolbar adapts display preferences and keeps load accessible', async ({ page }) => {
  for (const profession of ['elementalist', 'mesmer']) {
    await page.goto(`/${profession}.html`);
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    for (const width of [1920, 1440, 1100, 800, 390]) {
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
  await expect(time).toHaveCSS('font-size', '8px');
  const revision = await page.evaluate(() => window.professionApp.buildRevision);
  await display.selectOption('timings');
  await expect(time).toHaveCSS('font-size', '12px');
  const icon = page.locator('#rotation-timeline .rot-skill[data-idx] img').first();
  const bounds = await icon.boundingBox();
  expect(bounds.width).toBe(bounds.height);
  expect(bounds.width).toBe(60);
  await size.selectOption('large');
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(revision);
  await page.reload();
  await expect(display).toHaveValue('timings');
  await expect(size).toHaveValue('large');
  await expect(time).toHaveCSS('font-size', '12px');
  await display.selectOption('classic');
  await expect(time).toHaveCSS('font-size', '8px');
  await expect(size).toHaveValue('large');
});
