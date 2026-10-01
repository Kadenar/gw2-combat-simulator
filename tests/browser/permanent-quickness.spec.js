import { expect, test } from '@playwright/test';

// Legacy browser saves are repaired before rendering, while other boons remain editable.
test('quickness and alacrity stay active after restoring a build that disabled it', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const { adapter, build } = window.professionApp;
    const saved = structuredClone(build);
    saved.assumptions.quickness = false;
    saved.assumptions.alacrity = false;
    saved.assumptions.fury = false;
    saved.targetArmor = 2500;
    localStorage.removeItem(`${adapter.storageKey}-workspace-v1`);
    localStorage.setItem(adapter.storageKey, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();

  const boons = page.locator('#perma-boons');
  const alacrity = boons.getByRole('checkbox', { name: 'Alacrity', exact: true });
  await expect(alacrity).toBeChecked();
  await expect(alacrity).toBeDisabled();
  expect(await page.evaluate(() => window.professionApp.build.assumptions.alacrity)).toBe(true);
  const quickness = boons.getByRole('checkbox', { name: 'Quickness', exact: true });
  await expect(quickness).toBeVisible();
  await expect(boons.locator('.perma-item[data-wiki-name]')).toHaveCount(0);
  await expect(quickness).toBeChecked();
  await expect(quickness).toBeDisabled();
  expect(await page.evaluate(() => window.professionApp.build.assumptions.quickness)).toBe(true);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2500);
  await expect(boons.getByRole('checkbox', { name: 'Fury', exact: true })).not.toBeChecked();
  await boons.getByRole('checkbox', { name: 'Fury', exact: true }).check();
  expect(await page.evaluate(() => window.professionApp.build.assumptions.fury)).toBe(true);
  expect(await page.evaluate(() => window.professionApp.build.assumptions.quickness)).toBe(true);
});
