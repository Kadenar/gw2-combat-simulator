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

// Seed rotations through the editing owner so browser setup follows normal history and invalidation rules.
export async function insertRotationSkill(page, name, options = {}) {
  await page.evaluate(
    async ({ name, options }) => {
      const { createRotationItem } = await import('/js/games/gw2/app/rotation/editing/actions.ts');
      const { commitRotationEdit } = await import('/js/games/gw2/app/rotation/editing/commit.ts');
      const app = globalThis.professionApp;
      commitRotationEdit(app, { type: 'insert', entries: [createRotationItem(app, name, options)] });
    },
    { name, options }
  );
}
