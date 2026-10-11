import { expect, test } from '@playwright/test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';

// Browser coverage protects loading and editing the remaining control; formula and catalog matrices live in Node.
test('flat strike authoring hides ordinary coefficients and saves the flat damage edit', async ({ page }) => {
  const family = withPatchPreview(necromancerProfession);
  let saved;
  await page.route('**/api/patch-preview', async (route) => {
    if (route.request().method() === 'PUT') {
      saved = route.request().postDataJSON().preview;
      family.validatePatch(saved.professions.necromancer);
      await route.fulfill({ json: { preview: saved, sourceFile: 'fixture.ts' } });
    } else {
      await route.fulfill({ json: { preview: null, sourceFile: 'fixture.ts', professions: [family.patchAuthoring] } });
    }
  });
  await page.goto('/patch-preview.html', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-select-section="skills"]').click();
  await page.locator('[data-select-skill="30860"]').click();
  const siphon = page.locator('.patch-effect').filter({ hasText: 'Life Siphon' });
  await expect(siphon.locator('[data-numeric-field="coefficient"]')).toHaveCount(0);
  await expect(siphon.locator('[data-numeric-field="flatStrikeBase"]')).toBeVisible();
  await expect(page.locator('[data-numeric-field="coefficient"]').first()).toBeVisible();

  await page.locator('[data-select-section="mechanics"]').click();
  await page.locator('[data-select-profile="necromancer.core.soul-shards"]').click();
  await expect(page.locator('[data-numeric-field="coefficient"]')).toHaveCount(0);
  const effect = page.locator('.patch-effect');
  await effect.getByText('Advanced calibration fields', { exact: true }).click();
  const base = effect.locator('[data-numeric-field="flatStrikeBase"]');
  await base.fill('2000');
  await base.press('Tab');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect.poll(() => saved).toBeTruthy();
  const edits = saved.professions.necromancer.balanceProfiles['necromancer.core.soul-shards'].effects;
  expect(edits).toEqual([{ effectIndex: 0, flatStrikeBase: { from: 1504, to: 2000 } }]);
});
