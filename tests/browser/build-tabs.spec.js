import { expect, test } from '@playwright/test';

async function openWorkspace(page, viewport = { width: 1440, height: 1000 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
}

async function settled(page) {
  await page.waitForFunction(() => {
    const app = window.professionApp;
    return app.simulationStatus === 'idle' && app.buildRevision === app.resultRevision;
  });
}

// Exercise the user-facing actions against the real editor, then restore the saved workspace on refresh.
test('build tabs isolate edits and results and support duplication, inline rename, close, and refresh', async ({
  page
}) => {
  await openWorkspace(page);
  const strip = page.locator('#build-workspace-tabs');
  await expect(strip.locator('.build-tab-close')).toHaveCount(0);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await settled(page);
  const originalDps = await page.locator('#floating-dps').textContent();
  await strip.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await settled(page);
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(strip.locator('.build-tab-close')).toHaveCount(2);
  await strip.locator('.build-tab.is-active').hover();
  const rename = strip.getByRole('button', { name: 'Rename Build 1 copy', exact: true });
  await expect(rename).toHaveCSS('opacity', '1');
  page.once('dialog', (dialog) => dialog.accept('Alternative'));
  await rename.click();
  await page.locator('#btn-sim-clear').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
  await strip.getByRole('button', { name: 'Build 1', exact: true }).click();
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#floating-dps')).toHaveText(originalDps);
  await page.locator('#btn-sim-undo').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
  await strip.getByRole('button', { name: 'Alternative', exact: true }).click();
  await page.locator('#btn-sim-undo').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  await expect(page.locator('#rotation-results')).toContainText('Bladecall');
  await strip.getByRole('button', { name: 'Build 1', exact: true }).click();
  await expect(page.locator('#rotation-results')).toContainText('No analysis yet');
  await page.locator('.simulator-view-tab[data-simulator-view="workspace"]').click();
  await strip.getByRole('button', { name: 'Alternative', exact: true }).click();
  await strip.getByRole('button', { name: 'Close Build 1', exact: true }).click();
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.locator('.build-tab-close')).toHaveCount(0);
  await expect(strip.locator('.build-tab-notice')).toHaveCount(0);
  await expect(strip.getByRole('button', { name: 'Alternative', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.getByRole('button', { name: 'Alternative', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await strip.getByRole('button', { name: '+ New build', exact: true }).click();
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
});

test('template menu opens a complete build in a new tab', async ({ page }) => {
  await openWorkspace(page);
  // Small local assets exercise the menu without depending on a benchmark rotation.
  await page.route('**/data/gw2/builds/mesmer/b-*.json?*', async (route) => {
    const build = await page.evaluate(() => window.professionApp.build);
    await route.fulfill({ json: { ...build, targetArmor: 2400 } });
  });
  await page.route('**/data/gw2/builds/mesmer/r-*.json?*', (route) =>
    route.fulfill({ json: { rotation: [{ type: 'wait', durationMs: 10 }] } })
  );
  const preset = page.locator('.template-preset').first();
  await preset.locator('summary').click();
  await preset.getByRole('menuitem', { name: 'Open in new tab' }).click();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await settled(page);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  await page.locator('#build-workspace-tabs').getByRole('button', { name: 'Build 1', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).not.toBe(2400);
});

test('tab overflow stays inside its strip on narrow screens', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    for (let index = 0; index < 5; index += 1)
      addBuildTab(window.professionApp, window.professionApp.build, `Alternative build ${index}`);
  });
  const geometry = await page.locator('.build-tab-list').evaluate((list) => ({
    scrollWidth: list.scrollWidth,
    clientWidth: list.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport + 1);
  await expect(page.locator('.build-tab.is-active')).toBeInViewport();
});
