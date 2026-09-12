import { expect, test } from '@playwright/test';

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
