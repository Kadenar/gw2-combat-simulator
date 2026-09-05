import { expect, test } from '@playwright/test';

// A small manifest exercises grouping and intersecting filters without depending on saved rotations.
test('weapon-first templates group by role, collapse, and hide empty filtered groups', async ({ page }) => {
  await page.route('**/data/gw2/builds/mesmer/manifest.json*', (route) =>
    route.fulfill({
      json: [
        {
          section: 'Chronomancer',
          presets: [
            { label: 'Power (Sword/Dagger)', build: 'power.json', benchmarkDps: 12345 },
            { label: 'Condition (Scepter/Torch)', build: 'condition.json' },
            { label: 'Power Quickness (Spear)', build: 'quickness.json' },
            { label: 'Condition Alacrity (Staff)', build: 'alacrity.json' }
          ]
        },
        { section: 'Mirage', presets: [{ label: 'Condition (Axe)', build: 'axe.json' }] }
      ]
    })
  );
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  const templates = page.locator('.build-templates');
  await expect(templates).toBeVisible();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const chrono = templates.locator('.presets-group').filter({ hasText: 'Chronomancer' });
  const mirage = templates.locator('.presets-group').filter({ hasText: 'Mirage' });
  const power = chrono.locator('.template-subgroup').filter({ has: page.locator('summary', { hasText: /^Power$/ }) });
  const boon = chrono.locator('.template-subgroup').filter({ has: page.locator('summary', { hasText: /^Boon$/ }) });
  await expect(chrono.locator('.template-subgroup > summary')).toHaveText(['Power', 'Condition', 'Boon']);
  await expect(power.locator('.template-preset-name')).toHaveText('Sword & Dagger');
  await expect(power.locator('.template-preset-dps')).toHaveText('12,345 DPS');
  await expect(power.locator('.template-preset-boon')).toHaveCount(0);
  await expect(boon.locator('.template-preset-name')).toHaveText(['Spear', 'Staff']);
  await expect(boon.locator('.template-preset-boon')).toHaveText(['Quickness', 'Alacrity']);
  await expect(mirage.locator('.template-subgroup > summary')).toHaveText(['Condition']);

  await power.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(power.locator('.template-load-btn')).toBeHidden();
  await expect(boon.locator('.template-load-btn').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(power.locator('.template-load-btn')).toBeVisible();
  await expect(power.locator('.template-load-btn')).toHaveAttribute('title', 'Power (Sword/Dagger)');
  await power.locator('.template-actions > summary').click();
  await expect(power.getByRole('menuitem', { name: 'Open in new tab' })).toBeVisible();

  const selectFilter = async (attribute, value) => {
    const button = templates.locator(`[${attribute}="${value}"]`);
    await button.locator('xpath=ancestor::details/summary').click();
    await button.click();
  };

  await selectFilter('data-template-filter', 'power');
  await expect(mirage).toBeHidden();
  await expect(chrono.locator('.template-subgroup:not([hidden]) > summary')).toHaveText(['Power', 'Boon']);
  await expect(boon.locator('.template-preset:not([hidden]) .template-preset-name')).toHaveText(['Spear']);
  await selectFilter('data-template-boon-filter', 'alacrity');
  await expect(chrono).toBeHidden();
  await expect(templates.locator('.template-filter-empty')).toBeVisible();
  await selectFilter('data-template-filter', 'all');
  await expect(boon).toBeVisible();
  await expect(power).toBeHidden();
  await expect(boon.locator('.template-preset:not([hidden]) .template-preset-name')).toHaveText(['Staff']);
  await selectFilter('data-template-specialization-filter', 'Mirage');
  await expect(templates.locator('.template-filter-empty')).toBeVisible();
  await selectFilter('data-template-boon-filter', 'all');
  await expect(mirage).toBeVisible();
  await expect(chrono).toBeHidden();
  await expect(templates.locator('.template-filter-empty')).toBeHidden();
});
