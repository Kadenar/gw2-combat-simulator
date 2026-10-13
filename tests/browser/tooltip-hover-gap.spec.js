import { expect, test } from '@playwright/test';
import { mockGw2Icons } from '#tests/helpers/browser-icons.js';

// F-key cards must survive a slow crossing, allow returning to the icon, and dismiss after leaving both surfaces.
test('profession skill tooltip stays reachable across the hover gap', async ({ page }) => {
  await mockGw2Icons(page);
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const skill = page.locator('.profession-palette-section .pal-skill[data-wiki-name]').first();
  await skill.hover();
  const panel = page.locator('#wiki-tooltip');
  await expect(panel).toBeVisible();
  const name = await skill.getAttribute('data-wiki-name');
  const source = await skill.boundingBox();
  const card = await panel.boundingBox();
  const below = card.y >= source.y + source.height;
  expect(below || card.y + card.height <= source.y).toBe(true);
  const x = Math.max(source.x, card.x) + 4;
  const y = below ? (source.y + source.height + card.y) / 2 : (card.y + card.height + source.y) / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(350);
  await expect(panel).toBeVisible();
  await skill.hover();
  await page.waitForTimeout(350);
  await expect(panel).toBeVisible();
  await page.mouse.move(x, y);
  await page.waitForTimeout(350);
  await panel.getByRole('link').hover();
  await page.waitForTimeout(350);
  await expect(panel.locator('strong')).toHaveText(name);
  await page.mouse.move(0, 0);
  await expect(panel).toBeHidden();
});

// A real diagonal approach crosses Bloodthirster before reaching Combustive Shot's burst tabs.
test('Combustive Shot retains its card while crossing another Paragon F-key', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1100 });
  await mockGw2Icons(page);
  await page.goto('/warrior.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.weapons = ['Longbow', ''];
    app.build.alternateWeapons = ['Sword', 'Sword'];
    app.build.startingWeaponSet = 1;
    app.build.specializations = [
      { name: 'Strength', traits: '3-3-1' },
      { name: 'Arms', traits: '2-3-3' },
      { name: 'Paragon', traits: '1-1-2' }
    ];
    app.build.rotation = [];
    app.changed();
  });
  await expect(page.locator('#rotation-palette')).toHaveAttribute('aria-busy', 'false');
  const skill = page.locator('.pal-skill[data-skill="Combustive Shot"]');
  await skill.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  await skill.hover();
  const panel = page.locator('#wiki-tooltip');
  await expect(panel).toBeVisible();
  const source = await skill.boundingBox();
  const tab = panel.getByRole('tab', { name: 'Burst tier 3', exact: true });
  const destination = await tab.boundingBox();
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  let crossedNeighbor = false;
  for (let step = 1; step <= 40; step++) {
    const x = start.x + ((destination.x + destination.width / 2 - start.x) * step) / 40;
    const y = start.y + ((destination.y + destination.height / 2 - start.y) * step) / 40;
    await page.mouse.move(x, y);
    crossedNeighbor ||= await page
      .locator('.pal-skill[data-skill="Bloodthirster"]')
      .evaluate((element) => element.matches(':hover'));
    await page.waitForTimeout(20);
    await expect(panel.locator('strong')).toHaveText('Combustive Shot');
    await expect(panel).toBeVisible();
  }

  expect(crossedNeighbor).toBe(true);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  // Deliberately dwelling on the neighboring skill still opens its own card.
  await page.locator('.pal-skill[data-skill="Bloodthirster"]').hover();
  await expect(panel.locator('strong')).toHaveText('Bloodthirster');
  await page.mouse.move(0, 0);
  await expect(panel).toBeHidden();
});
