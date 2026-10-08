import { expect, test } from '@playwright/test';

// The extra artifact row must stay visible and use worker-projected inventory when inserted through the palette.
test('Scuffle unlocks the bomb in its artifact row and using it spends the grant', async ({ page }) => {
  await page.goto('/thief.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#btn-sim-clear').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.specializations = [
      { name: 'Deadly Arts', traits: '1-1-1' },
      { name: 'Critical Strikes', traits: '1-1-1' },
      { name: 'Antiquary', traits: '1-1-1' }
    ];
    app.build.selectedSkillIds.Elite = 77255;
    app.changed();
  });
  const settled = () =>
    page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await settled();
  const bomb = page.locator('.antiquary-artifacts-scuffle .pal-skill[data-skill-id="76909"]');
  await expect(bomb).toBeVisible();
  await expect(bomb).toHaveClass(/pal-disabled/);
  const defensive = await page.locator('.antiquary-artifacts-defensive').boundingBox();
  const bombBox = await bomb.boundingBox();
  expect(bombBox.y).toBeGreaterThanOrEqual(defensive.y + defensive.height);
  await page.locator('.pal-skill[data-skill-id="77255"]').click();
  await settled();
  await expect(bomb).not.toHaveClass(/pal-disabled/);
  await bomb.click();
  await settled();
  await expect(bomb).toHaveClass(/pal-disabled/);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
});
