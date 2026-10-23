import { expect, test } from '@playwright/test';

// One worker-projected resource exercises the shared meter's browser wiring; Node covers the profession matrix.
test('profession resources render through the shared meter UI', async ({ page }) => {
  await page.goto('/revenant.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const meter = page.locator('.active-resource[data-resource-id="energy"]');
  await expect(meter).toBeVisible();
  expect(Number.isFinite(Number(await meter.getAttribute('data-resource-count')))).toBe(true);
});
