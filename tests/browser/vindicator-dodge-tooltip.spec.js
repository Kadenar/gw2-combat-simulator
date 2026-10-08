import { expect, test } from '@playwright/test';
import { mockGw2Icons } from '#tests/helpers/browser-icons.js';

// Hover the rendered palette after a build change to exercise selection plumbing and tooltip cache invalidation.
test('Vindicator dodge tooltip refreshes when the selected grandmaster changes', async ({ page }) => {
  await mockGw2Icons(page);
  await page.goto('/revenant.html#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const build = await (await fetch('/data/gw2/builds/revenant/b-power-vindicator-greatsword-energy.json')).json();
    app.build = app.adapter.toApplicationBuild({ ...build, rotation: [] });
    app.changed();
  });
  const palette = page.locator('#rotation-palette');
  const dodge = palette.locator('[data-skill="Dodge Jump"]');
  const tooltip = page.locator('#wiki-tooltip');
  // Wait for the worker's palette replacement so layout changes cannot move an adjacent tile under the pointer.
  await expect(palette).toHaveAttribute('aria-busy', 'false');
  await dodge.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Death Drop');
  await expect(tooltip).not.toContainText('Alacrity');
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.specializations.find(({ name }) => name === 'Vindicator').traits = '1-1-3';
    app.changed();
  });
  await expect(palette).toHaveAttribute('aria-busy', 'false');
  await dodge.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Alacrity');
  await expect(tooltip).not.toContainText('Death Drop');
});
