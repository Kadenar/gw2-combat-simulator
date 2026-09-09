import { expect, test } from '@playwright/test';

async function openWorkspace(page, viewport = { width: 1440, height: 1000 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
}

async function newBuild(page) {
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: 'New blank build', exact: true }).click();
}

async function buildAction(page, name) {
  await page.getByRole('button', { name: 'Build actions', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
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
  await buildAction(page, 'Duplicate build');
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
  page.once('dialog', (dialog) => dialog.accept());
  await strip.getByRole('button', { name: 'Close Build 1', exact: true }).click();
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.locator('.build-tab-close')).toHaveCount(0);
  await expect(strip.locator('.build-tab-notice')).toBeHidden();
  await expect(strip.getByRole('button', { name: 'Alternative', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.getByRole('button', { name: 'Alternative', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await newBuild(page);
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
});

// Validate cancellation, keyboard submission, and the target tab independently of the active editor.
test('rename dialog validates names and restores focus without switching builds', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  const strip = page.locator('#build-workspace-tabs');
  await newBuild(page);
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
  await expect(page.locator('.build-tab-new')).toBeInViewport();
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
  await expect(add).toContainText('New');
  await tab.hover();
  await expect(controls).toHaveCSS('opacity', '1');
  expect((await tab.boundingBox()).width).toBe(before.width);
  await page.mouse.move(0, 0);
  await tab.getByRole('button', { name: 'Build 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(tab.getByRole('button', { name: 'Rename Build 1', exact: true })).toBeFocused();
  await expect(controls).toHaveCSS('opacity', '1');
  await newBuild(page);
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await expect(add).toBeFocused();
});

// Both responsive layouts keep all actions reachable without widening the iframe.
test('toolbar adapts to narrow embeds and native menus dismiss with keyboard and outside clicks', async ({ page }) => {
  await page.goto('/mesmer.html?embed=1');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    for (let index = 0; index < 5; index += 1)
      addBuildTab(window.professionApp, window.professionApp.build, `Alternative build ${index}`);
  });
  for (const width of [1100, 700, 390, 320, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = width <= 600;
    await expect(page.locator('.build-tab-list')).toBeVisible();
    if (!mobile) {
      await expect(page.locator('#btn-export-build')).toBeVisible();
      await expect(page.locator('.build-tab.is-active')).toBeInViewport();
    }

    await page.locator('#build-actions-trigger').click();
    const menu = page.locator('#build-actions-menu');
    await expect(menu).toBeInViewport();
    await expect(menu.locator('#btn-export-build')).toHaveCount(mobile ? 1 : 0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.locator('#build-actions-trigger')).toBeFocused();
    await page.locator('.build-tab-new').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'New blank build' })).toBeFocused();
    await page.locator('.gear-heading h3').click();
    await expect(page.locator('#build-new-menu')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const newButton = await page.locator('.build-tab-new').boundingBox();
    const actions = await page.locator('#build-actions-trigger').boundingBox();
    expect(Math.abs(newButton.y - actions.y)).toBeLessThan(2);
  }

  const nav = await page.locator('.simulator-view-tabs').boundingBox();
  const firstTab = await page.locator('.build-tab-list').boundingBox();
  const help = await page.locator('.community-actions').boundingBox();
  expect(nav.x).toBe(firstTab.x + 2);
  expect(help.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(24);
});

// Reparented controls keep their original listeners, and destructive actions still allow cancellation.
test('mobile actions export, import, reset, and delete the active build', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  const original = await page.evaluate(() => structuredClone(window.professionApp.build));
  const download = page.waitForEvent('download');
  await buildAction(page, /Export$/);
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  const chooser = page.waitForEvent('filechooser');
  await buildAction(page, /Import$/);
  await (
    await chooser
  ).setFiles({
    name: 'build.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...original, targetArmor: 2400 }))
  });
  await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  page.once('dialog', (dialog) => dialog.dismiss());
  await buildAction(page, 'Reset build');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  page.once('dialog', (dialog) => dialog.accept());
  await buildAction(page, 'Reset build');
  await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(original.targetArmor);
  await newBuild(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('.build-tab.is-active').hover();
  await page.locator('.build-tab.is-active .build-tab-close').click();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.build-tab.is-active').hover();
  await page.locator('.build-tab.is-active .build-tab-close').click();
  await expect(page.locator('.build-tab')).toHaveCount(1);
  await expect(page.locator('.build-tab-close')).toHaveCount(0);
});
