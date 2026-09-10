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

async function tabAction(page, name, tabName) {
  const trigger = tabName
    ? page.getByRole('button', { name: `Options for ${tabName}`, exact: true })
    : page.locator('.build-tab.is-active .build-tab-menu-trigger');
  await trigger.click();
  await page.locator('#build-tab-menu').getByRole('button', { name, exact: true }).click();
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
  await expect(strip.locator('.build-tab-menu-trigger')).toHaveCount(1);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await settled(page);
  const originalDps = await page.locator('#floating-dps').textContent();
  await tabAction(page, 'Duplicate tab');
  await settled(page);
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(strip.locator('.build-tab-menu-trigger')).toHaveCount(2);
  await tabAction(page, 'Rename');
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
  await tabAction(page, 'Close tab', 'Build 1');
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.locator('.build-tab-menu-trigger')).toHaveCount(1);
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
  const rename = strip.getByRole('button', { name: 'Options for Build 1', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Rename build', exact: true });
  const input = dialog.getByRole('textbox', { name: 'Build name' });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await rename.focus();
  await rename.click();
  await page.locator('#build-tab-menu').getByRole('button', { name: 'Rename', exact: true }).click();
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
  await page.locator('#build-tab-menu').getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(input).toHaveValue('Build 1');
  await input.fill('Discard this too');
  await input.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rename).toBeFocused();
  await rename.click();
  await page.locator('#build-tab-menu').getByRole('button', { name: 'Rename', exact: true }).click();
  await input.fill('  Alternative <build>  ');
  await input.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip.getByRole('button', { name: 'Options for Alternative <build>', exact: true })).toBeFocused();
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
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
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
  // Build switching stays reachable alongside navigation after scrolling the editor.
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator('#app > header')).toHaveClass(/simulator-header-scrolled/);
  await expect(page.locator('#build-workspace-tabs')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.simulator-view-tabs')).toBeInViewport({ ratio: 1 });
});

// Every tab exposes the same actions without switching builds merely to inspect its menu.
test('tab dropdown exposes its actions and supports keyboard dismissal', async ({ page }) => {
  await openWorkspace(page);
  const tab = page.locator('.build-tab').first();
  const trigger = tab.locator('.build-tab-menu-trigger');
  await tab.getByRole('button', { name: 'Build 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  const menu = page.locator('#build-tab-menu');
  await expect(menu.locator('button')).toHaveText([
    'Load template\u2026',
    'Rename',
    'Duplicate tab',
    'Reset build',
    'Close tab'
  ]);
  await expect(menu.getByRole('button', { name: 'Close tab' })).toBeDisabled();
  await expect(menu.getByRole('button', { name: /Load template/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await newBuild(page);
  await tabAction(page, 'Duplicate tab', 'Build 1');
  await expect(page.locator('.build-tab')).toHaveCount(3);
  await expect(page.locator('.build-tab.is-active')).toContainText('Build 1 copy');
  await expect(page.locator('.build-tab.is-active .build-tab-menu-trigger')).toBeFocused();
});

// Loading from a tab replaces that destination while New continues to create independent builds.
test('tab menu loads a template into the chosen tab and resets only that build', async ({ page }) => {
  let releaseBuild;
  const buildReady = new Promise((resolve) => {
    releaseBuild = resolve;
  });
  await page.route('**/data/gw2/builds/mesmer/manifest.json*', (route) =>
    route.fulfill({
      json: [
        { section: 'Mirage', presets: [{ label: 'Power (Spear)', build: 'data/gw2/builds/mesmer/b-menu-test.json' }] }
      ]
    })
  );
  await page.route('**/data/gw2/builds/mesmer/b-menu-test.json*', async (route) => {
    await buildReady;
    const build = await page.evaluate(() => window.professionApp.build);
    await route.fulfill({ json: { ...build, targetArmor: 2400 } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mesmer.html?embed=1');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const initialArmor = await page.evaluate(() => window.professionApp.build.targetArmor);
  const originalId = await page.locator('.build-tab-menu-trigger').getAttribute('data-build-tab-id');
  const originalTrigger = page.locator(`.build-tab-menu-trigger[data-build-tab-id="${originalId}"]`);
  await newBuild(page);
  await tabAction(page, /Load template/, 'Build 1');
  const dialog = page.locator('#build-templates-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('.template-load-btn').click();
  await expect(dialog).toBeHidden();
  // Hold the download to verify that dismissal and progress do not wait for the assets.
  await expect(page.locator('.template-load-status')).toContainText('Loading Mirage · Power (Spear)');
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toBeVisible();
  await expect(page.locator('#rotation-timeline .rot-skill:visible')).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(initialArmor);
  await expect(originalTrigger).toBeFocused();
  releaseBuild();
  await expect(page.locator('.template-load-status')).toBeHidden();
  await settled(page);
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toHaveCount(0);
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await expect(originalTrigger).toBeFocused();
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  await page.getByRole('button', { name: 'New build', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(initialArmor);
  await originalTrigger.click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#build-tab-menu').getByRole('button', { name: 'Reset build' }).click();
  await expect(originalTrigger).toBeFocused();
  expect(await page.evaluate(() => window.professionApp.workspace.activeTabId)).toBe(originalId);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(initialArmor);
});

// A failed background download leaves the current build intact and allows the same template to be retried.
test('failed template loading clears progress and re-enables the picker', async ({ page }) => {
  let releaseBuild;
  const buildReady = new Promise((resolve) => {
    releaseBuild = resolve;
  });
  await page.route('**/data/gw2/builds/mesmer/b-*.json*', async (route) => {
    await buildReady;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await openWorkspace(page);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await settled(page);
  const originalBuild = await page.evaluate(() => window.professionApp.build);
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
  const picker = page.locator('#build-templates-dialog');
  await picker.locator('.template-load-btn').first().click();
  await expect(picker).toBeHidden();
  await expect(page.locator('.template-load-status')).toBeVisible();
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toBeVisible();
  await expect(page.locator('#rotation-timeline .rot-skill:visible')).toHaveCount(0);
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
  await expect(picker.locator('.template-load-btn').first()).toBeDisabled();
  const failure = page.waitForEvent('dialog');
  releaseBuild();
  const alert = await failure;
  expect(alert.message()).toContain('Failed to load');
  await alert.accept();
  await expect(page.locator('.template-load-status')).toBeHidden();
  await expect(picker.locator('.template-load-btn').first()).toBeEnabled();
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toHaveCount(0);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
  expect(await page.evaluate(() => window.professionApp.build)).toEqual(originalBuild);
  await expect(page.locator('.build-tab')).toHaveCount(1);
});

// Both responsive layouts keep all actions reachable without widening the iframe.
test('toolbar adapts to narrow embeds and native menus dismiss with keyboard and outside clicks', async ({ page }) => {
  await page.goto('/mesmer.html?embed=1');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  // Larger labels cover wider platform font metrics without depending on a host-installed font.
  await page.addStyleTag({
    content: '@media (max-width: 360px) { body[data-profession] .simulator-view-tab { font-size: 12px; } }'
  });
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    for (let index = 0; index < 5; index += 1)
      addBuildTab(window.professionApp, window.professionApp.build, `Alternative build ${index}`);
  });
  for (const width of [1100, 700, 390, 320, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    // Embedded headers keep both rows visible as the header wraps at each width.
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator('#app > header')).toHaveClass(/simulator-header-scrolled/);
    await expect(page.locator('#build-workspace-tabs')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.simulator-view-tabs')).toBeInViewport({ ratio: 1 });
    const mobile = width <= 600;
    await expect(page.locator('.build-tab-list')).toBeVisible();
    if (!mobile) {
      await expect(page.locator('#btn-export-build')).toBeVisible();
      await expect(page.locator('.build-tab.is-active')).toBeInViewport();
    }

    const trigger = page.locator(mobile ? '#build-actions-trigger' : '.build-tab.is-active .build-tab-menu-trigger');
    await trigger.click();
    const menu = page.locator(mobile ? '#build-actions-menu' : '#build-tab-menu');
    await expect(menu).toBeInViewport();
    await expect(menu.locator('#btn-export-build')).toHaveCount(mobile ? 1 : 0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.locator('.build-tab-new').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'New blank build' })).toBeFocused();
    // Click a named heading outside the popover to exercise native dismissal across layouts.
    await page.getByRole('heading', { name: 'Gear loadout', exact: true }).click();
    await expect(page.locator('#build-new-menu')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const newButton = await page.locator('.build-tab-new').boundingBox();
    const actions = await page.locator(mobile ? '#build-actions-trigger' : '#btn-export-build').boundingBox();
    const tab = await page.locator('.build-tab.is-active').boundingBox();
    expect(Math.abs(newButton.y - actions.y)).toBeLessThan(2);
    expect(Math.abs(newButton.y - tab.y)).toBeLessThan(2);
  }

  const nav = await page.locator('.simulator-view-tabs').boundingBox();
  const firstTab = await page.locator('.build-tab-list').boundingBox();
  const help = await page.locator('.community-actions').boundingBox();
  expect(nav.x).toBe(firstTab.x);
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
  await tabAction(page, 'Reset build');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  page.once('dialog', (dialog) => dialog.accept());
  await tabAction(page, 'Reset build');
  await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(original.targetArmor);
  await newBuild(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await tabAction(page, 'Close tab');
  await expect(page.locator('.build-tab')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await tabAction(page, 'Close tab');
  await expect(page.locator('.build-tab')).toHaveCount(1);
  await page.locator('.build-tab.is-active .build-tab-menu-trigger').click();
  await expect(page.locator('#build-tab-menu').getByRole('button', { name: 'Close tab' })).toBeDisabled();
});
