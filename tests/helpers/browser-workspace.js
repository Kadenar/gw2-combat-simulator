import { expect } from '@playwright/test';

// Exercises computed layout in a real browser so CSS refactors are not coupled to stylesheet source text.
export async function openSimulator(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
}

// Templates live in a dialog; use its launcher before selecting a build.
export async function openTemplates(page) {
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
  await expect(page.locator('#build-templates-dialog')).toBeVisible();
}
