import { expect, test } from '@playwright/test';

// Representative pip, bar, and composite meters exercise browser wiring; Node covers the profession matrix.
test('pip, bar, and composite resources render through the shared meter UI', async ({ page }) => {
  test.setTimeout(60_000);
  for (const [profession, specialization, resourceId] of [
    ['mesmer', 'Virtuoso', 'blades'],
    ['revenant', null, 'energy'],
    ['elementalist', 'Evoker', 'evoker-charges']
  ]) {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    if (specialization) {
      const picker = page.locator('.spec-picker').last();
      await picker.locator('summary').click();
      // A default build may already select the requested specialization, disabling its option.
      const option = picker.getByRole('button', { name: specialization, exact: true });
      if ((await option.getAttribute('aria-pressed')) === 'true') await picker.locator('summary').click();
      else await option.click();
    }

    await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
    const meter = page.locator(`.active-resource[data-resource-id="${resourceId}"]`);
    await expect(meter).toBeVisible();
    expect(Number.isFinite(Number(await meter.getAttribute('data-resource-count')))).toBe(true);
  }
});
