import { expect, test } from '@playwright/test';

// Canonical resource clocks must survive the real app boundary and render finite meter values.
test('profession resource clocks render through the shared meter UI', async ({ page }) => {
  test.setTimeout(60_000);
  for (const [profession, specialization, resourceId, key] of [
    ['thief', null, 'initiative', 'initiative'],
    ['guardian', 'Firebrand', 'pages', 'tomePages'],
    ['ranger', 'Galeshot', 'arrows', 'arrows'],
    ['revenant', null, 'energy', 'energy'],
    ['necromancer', null, 'life-force', 'lifeForce']
  ]) {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    if (specialization) {
      const picker = page.locator('.spec-picker').last();
      await picker.locator('summary').click();
      await picker.getByRole('button', { name: specialization, exact: true }).click();
    }

    await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
    const meter = page.locator(`.active-resource[data-resource-id="${resourceId}"]`);
    await expect(meter).toBeVisible();
    expect(Number.isFinite(Number(await meter.getAttribute('data-resource-count')))).toBe(true);
    const pool = await page.evaluate((key) => window.professionApp.results.planningState.profession[key], key);
    expect(Number.isFinite(pool.value)).toBe(true);
    expect(pool.maximum).toBeGreaterThan(0);
    expect(pool.value).toBeLessThanOrEqual(pool.maximum);
  }
});
