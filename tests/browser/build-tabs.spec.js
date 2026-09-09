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
test('build tabs isolate edits and results and support duplication, rename, close, and refresh', async ({ page }) => {
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
  await expect(strip.locator('.build-tab.is-active .build-tab-controls')).toHaveCSS('opacity', '1');
  await rename.click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename build', exact: true });
  await renameDialog.getByRole('textbox', { name: 'Build name' }).fill('Alternative');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(renameDialog).toHaveCount(0);
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
  await strip.getByRole('button', { name: 'Build 1', exact: true }).hover();
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
  await strip.getByRole('button', { name: 'New build', exact: true }).click();
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
});

// Validate cancellation, keyboard submission, and the target tab independently of the active editor.
test('rename dialog validates names and restores focus without switching builds', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  const strip = page.locator('#build-workspace-tabs');
  await strip.getByRole('button', { name: 'New build', exact: true }).click();
  const rename = strip.getByRole('button', { name: 'Rename Build 1', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Rename build', exact: true });
  const input = dialog.getByRole('textbox', { name: 'Build name' });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await rename.focus();
  await rename.click();
  await expect(dialog).toBeInViewport();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Build 1');
  expect(await input.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(
    'Build 1'
  );
  await expect(input).toHaveAttribute('maxlength', '80');
  await input.fill('   ');
  await expect(save).toBeDisabled();
  await input.press('Enter');
  await expect(dialog).toBeVisible();
  await input.fill('Discard this');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rename).toBeFocused();
  await rename.click();
  await expect(input).toHaveValue('Build 1');
  await input.fill('Discard this too');
  await input.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rename).toBeFocused();
  await rename.click();
  await input.fill('  Alternative <build>  ');
  await input.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip.getByRole('button', { name: 'Rename Alternative <build>', exact: true })).toBeFocused();
  await expect(strip.getByRole('button', { name: 'Alternative <build>', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(strip.getByRole('button', { name: 'New build', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true'
  );
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
  await expect(page.getByRole('button', { name: 'New build', exact: true })).toBeInViewport();
});

// Hidden controls leave the tab width alone and remain reachable without a mouse.
test('tab icons overlay labels on hover and keyboard focus, with an adjacent add button', async ({ page }) => {
  await openWorkspace(page);
  const tab = page.locator('.build-tab').first();
  const controls = tab.locator('.build-tab-controls');
  const add = page.locator('.build-tab-new');
  await page.mouse.move(0, 0);
  await expect(controls).toHaveCSS('opacity', '0');
  const before = await tab.boundingBox();
  const plus = await add.boundingBox();
  expect(plus.x - (before.x + before.width)).toBeLessThan(16);
  await expect(add).toHaveText('');
  await tab.hover();
  await expect(controls).toHaveCSS('opacity', '1');
  expect((await tab.boundingBox()).width).toBe(before.width);
  await page.mouse.move(0, 0);
  await tab.getByRole('button', { name: 'Build 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(tab.getByRole('button', { name: 'Rename Build 1', exact: true })).toBeFocused();
  await expect(controls).toHaveCSS('opacity', '1');
  await add.click();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await expect(add).toBeFocused();
});
