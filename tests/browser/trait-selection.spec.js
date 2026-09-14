import { expect, test } from '@playwright/test';

// Clicking active traits removes their effects, persists the empty build, and leaves every trait available again.
test('all major and minor traits toggle off and back on', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const panel = page.locator('#traits-panel');
  const active = panel.locator('.spec-trait-major.sel, .spec-trait-minor.sel');
  const count = await active.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await active.first().click();
  }

  await expect(active).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.attributeData.activeTraits)).toEqual([]);
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(active).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.attributeData.activeTraits)).toEqual([]);

  const minor = panel.locator('.spec-trait-minor').first();
  const major = panel.locator('.spec-trait-major').first();
  await minor.focus();
  await minor.press('Enter');
  await expect(minor).toBeFocused();
  await expect(minor).toHaveAttribute('aria-pressed', 'true');
  await major.click();
  await expect(major).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.professionApp.attributeData.activeTraits.length)).toBe(2);

  const replacement = panel.locator('.spec-trait-major').nth(1);
  await replacement.click();
  await expect(major).toHaveAttribute('aria-pressed', 'false');
  await expect(replacement).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.professionApp.attributeData.activeTraits.length)).toBe(2);
});
