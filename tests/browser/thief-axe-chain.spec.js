import { expect, test } from '@playwright/test';

// One visible tile follows worker-projected chain state when clicked and after a normal chain reset.
test('Spinning Axe shares one tile that alternates and resets', async ({ page }) => {
  await page.goto('/thief.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#btn-sim-clear').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.weapons = ['Axe', 'Pistol'];
    app.build.startingWeaponSet = 1;
    app.changed();
  });
  const axe = page.locator('.pal-skill[data-skill="Spinning Axe"]');
  const settled = () =>
    page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await settled();
  await expect(axe).toHaveCount(1);
  await expect(axe).toHaveAttribute('data-skill-id', '71967');
  await axe.click();
  await settled();
  await expect(axe).toHaveAttribute('data-skill-id', '71854');
  await axe.click();
  await settled();
  await expect(axe).toHaveAttribute('data-skill-id', '71967');
  await axe.click();
  await settled();
  await expect(axe).toHaveAttribute('data-skill-id', '71854');
  await page.locator('.pal-skill[data-skill-id="71852"]').click();
  await settled();
  await expect(axe).toHaveCount(1);
  await expect(axe).toHaveAttribute('data-skill-id', '71967');
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
});
