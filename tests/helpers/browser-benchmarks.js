import { readFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';

// Interaction tests use every saved benchmark regardless of live freshness flags.
// Tests of freshness filtering supply their own manifest rows; Node tests cover the filter rules.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/\/data\/gw2\/builds\/[^/]+\/manifest\.json(?:\?.*)?$/, async (route) => {
      // Read fixture data locally so freshness overrides do not depend on a second HTTP request.
      const pathname = new URL(route.request().url()).pathname;
      const manifest = new URL(`../..${pathname}`, import.meta.url);
      const sections = JSON.parse(await readFile(manifest, 'utf8'));
      for (const section of sections) {
        for (const preset of section.presets) preset.upToDate = true;
      }

      await route.fulfill({ json: sections });
    });
    await use(page);
  }
});

export async function openDashboard(page, path = '/mesmer.html#benchmarks') {
  await page.goto(path);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
}

// Explicit test populations use the same additive profession controls as real comparisons.
export async function selectProfessions(page, ...ids) {
  const all = page.locator('[data-benchmark-profession="all"]');

  if ((await all.getAttribute('aria-pressed')) !== 'true') await all.click();

  await all.click();
  for (const id of ids) await page.locator(`[data-benchmark-profession="${id}"]`).click();
}
