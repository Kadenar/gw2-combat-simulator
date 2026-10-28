import { expect } from '@playwright/test';

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
