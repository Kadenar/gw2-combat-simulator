import { expect, test } from '@playwright/test';

// Exercise the real starting pip, worker availability, and saved build without repeating the Node trait matrix.
test('pre-steal toggles beside initiative and survives reload', async ({ page }) => {
  await page.goto('/thief.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#btn-sim-clear').click();
  const picker = page.locator('.spec-picker').last();
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Daredevil', exact: true }).click();
  const settled = () =>
    page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await settled();
  const pip = page.locator('.start-resource-controls [data-resource-key="initialPreSteal"]');
  await expect(pip).toBeVisible();
  await expect(page.locator('.start-resource-controls [data-resource-key="initialInitiative"]').first()).toBeVisible();
  await pip.click();
  await settled();
  await expect(pip).toHaveClass(/active/);
  const plasma = page.locator('.pal-skill[data-skill="Detonate Plasma"]');
  await plasma.click();
  await settled();
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await settled();
  await expect(pip).toHaveClass(/active/);
  await page.locator('#btn-sim-clear').click();
  await settled();
  await pip.click();
  await settled();
  await expect(pip).not.toHaveClass(/active/);
  expect(await page.evaluate(() => window.professionApp.build.initialPreSteal)).toBe(0);
});
