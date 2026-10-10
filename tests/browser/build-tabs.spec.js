import { expect, test } from '@playwright/test';

async function openWorkspace(page, viewport = { width: 1440, height: 1000 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
}

// A real reload converts persisted names before rendering and saves only canonical IDs for subsequent visits.
test('legacy workspace builds migrate once on startup without losing selected skills', async ({ page }) => {
  await openWorkspace(page);
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const expected = await page.evaluate(() => {
    const app = window.professionApp;
    const { selectedSkillIds, ...fields } = structuredClone(app.build);
    const legacy = {
      ...fields,
      schemaVersion: fields.schemaVersion - 1,
      selectedSkills: Object.fromEntries(
        Object.entries(selectedSkillIds).map(([slot, id]) => [slot, id === null ? '' : app.skillById.get(id).name])
      )
    };
    localStorage.setItem(
      `${app.adapter.storageKey}-workspace-v1`,
      JSON.stringify({
        version: 1,
        activeTabId: 'legacy',
        tabs: [{ id: 'legacy', name: 'Legacy build', build: legacy, templateBuild: legacy }]
      })
    );
    return selectedSkillIds;
  });
  for (let visit = 0; visit < 2; visit++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    const loaded = await page.evaluate(() => {
      const app = window.professionApp;
      const saved = JSON.parse(localStorage.getItem(`${app.adapter.storageKey}-workspace-v1`));
      return { selected: app.build.selectedSkillIds, tab: saved.tabs.find((tab) => tab.id === 'legacy') };
    });
    expect(loaded.selected).toEqual(expected);
    expect(loaded.tab.build.selectedSkillIds).toEqual(expected);
    expect(loaded.tab.templateBuild.selectedSkillIds).toEqual(expected);
    expect(loaded.tab.build).not.toHaveProperty('selectedSkills');
    expect(loaded.tab.templateBuild).not.toHaveProperty('selectedSkills');
  }
});

// Profession changes retain the selected tool and display flags; tool links still support browser history.
test('header profession selector preserves navigation and the landing page owns the copyright', async ({ page }) => {
  await page.goto('/mesmer.html?embed=1&standalone=1#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const navigation = page.getByRole('navigation', { name: 'Simulator sections' });
  const selector = navigation.getByRole('button', { name: 'Choose profession', exact: true });
  await expect(selector).toHaveText('Mesmer');
  await selector.focus();
  await page.keyboard.press('Enter');
  const professions = page.getByRole('group', { name: 'Professions', exact: true });
  await expect(professions.getByRole('link')).toHaveCount(9);
  await expect(professions.locator('img')).toHaveCount(9);
  await expect
    .poll(() => professions.locator('img').evaluateAll((images) => images.every((image) => image.naturalWidth > 0)))
    .toBe(true);
  await expect(professions.getByRole('link', { name: 'Mesmer', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(professions).toBeHidden();
  await expect(selector).toBeFocused();
  await selector.click();
  // DPS now sits beneath this popover; dismiss through an unobscured editor heading.
  await page.getByRole('heading', { name: 'Gear loadout', exact: true }).click();
  await expect(professions).toBeHidden();
  await navigation.getByRole('link', { name: 'Analysis', exact: true }).click();
  await expect(navigation.getByRole('link', { name: 'Analysis', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(navigation.getByRole('link', { name: 'Workspace', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await navigation.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  await selector.click();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(professions).toBeInViewport({ ratio: 1 });
  }

  await professions.getByRole('link', { name: 'Guardian', exact: true }).click();
  await expect(page).toHaveURL(/guardian\.html\?embed=1&standalone=1#gear-optimizer$/);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(selector).toHaveText('Guardian');
  await expect(navigation.getByRole('link', { name: 'Gear Optimizer', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(page.locator('#app > header #header-dps')).toBeVisible();
  await expect(page.locator('.landing-footer')).toHaveCount(0);

  await page.goto('/index.html');
  await expect(page.locator('.landing-footer')).toContainText('All rights reserved.');
  await expect(page.locator('#header-dps')).toHaveCount(0);
});

async function newBuild(page) {
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: 'New blank build', exact: true }).click();
}

// Closing a build leaves the switcher menu open, so only toggle it when it is closed.
async function openSwitcher(page) {
  const menu = page.locator('#build-switcher-menu');
  if (!(await menu.evaluate((element) => element.matches(':popover-open'))))
    await page.locator('#build-switcher').click();
  await expect(menu).toBeVisible();
  return menu;
}

async function selectBuild(page, name) {
  const menu = await openSwitcher(page);
  await menu.locator('.build-tab-list').getByRole('button', { name, exact: true }).click();
}

async function closeBuild(page, name) {
  const menu = await openSwitcher(page);
  await menu.getByRole('button', { name: `Close ${name}`, exact: true }).click();
}

// Build actions always apply to the build being edited.
async function tabAction(page, name) {
  const menu = await openSwitcher(page);
  await menu.getByRole('button', { name, exact: true }).click();
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
  const current = strip.locator('.build-switcher-name');
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.locator('.build-switcher-count')).toHaveText('1 open build');
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await settled(page);
  const originalDps = await page.locator('#header-dps').textContent();
  await tabAction(page, 'Duplicate');
  await settled(page);
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(strip.locator('.build-switcher-count')).toHaveText('2 open builds');
  await tabAction(page, 'Rename');
  const renameDialog = page.getByRole('dialog', { name: 'Rename build', exact: true });
  await renameDialog.getByRole('textbox', { name: 'Build name' }).fill('Alternative');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(renameDialog).toHaveCount(0);
  await page.locator('#btn-sim-clear').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
  await selectBuild(page, 'Build 1');
  await expect(current).toHaveText('Build 1');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#header-dps')).toHaveText(originalDps);
  await page.locator('#btn-sim-undo').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
  await selectBuild(page, 'Alternative');
  await page.locator('#btn-sim-undo').click();
  await settled(page);
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  await expect(page.locator('#rotation-results')).toContainText('Bladecall');
  await selectBuild(page, 'Build 1');
  await expect(page.locator('#rotation-results')).toContainText('No analysis yet');
  await page.locator('.simulator-view-tab[data-simulator-view="workspace"]').click();
  await selectBuild(page, 'Alternative');
  // A build other than the one being edited closes from its own row without switching to it.
  await closeBuild(page, 'Build 1');
  await page
    .getByRole('dialog', { name: 'Close this build?' })
    .getByRole('button', { name: 'Close build', exact: true })
    .click();
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(strip.locator('.build-tab-notice')).toBeHidden();
  await expect(current).toHaveText('Alternative');
  await expect(strip.getByRole('button', { name: 'Alternative', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(strip.locator('.build-tab')).toHaveCount(1);
  await expect(current).toHaveText('Alternative');
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await newBuild(page);
  await expect(strip.locator('.build-tab')).toHaveCount(2);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
});

// Closing confirms the named row locally; cancellation keeps builds intact and returns focus to that row.
test('close confirmation sits beside the builds menu and supports safe keyboard and pointer dismissal', async ({
  page
}) => {
  await openWorkspace(page);
  await newBuild(page);
  const menu = page.locator('#build-switcher-menu');
  const popup = page.getByRole('dialog', { name: 'Close this build?', exact: true });
  const close = menu.getByRole('button', { name: 'Close Build 1', exact: true });
  await closeBuild(page, 'Build 1');
  await expect(popup).toContainText('Build 1');
  await expect(popup.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(menu).toBeVisible();
  const menuBounds = await menu.boundingBox();
  const popupBounds = await popup.boundingBox();
  expect(popupBounds.x).toBeGreaterThanOrEqual(menuBounds.x + menuBounds.width);
  await expect(popup).toBeInViewport({ ratio: 1 });
  // Enter starts on Cancel, preventing accidental removal when the confirmation first opens.
  await page.keyboard.press('Enter');
  await expect(popup).toHaveCount(0);
  await expect(close).toBeFocused();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await close.click();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(close).toBeFocused();
  await expect(menu).toBeVisible();
  await close.click();
  await menu.getByText('Current build', { exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await close.click();
  await page.locator('#header-dps').click();
  await expect(popup).toHaveCount(0);
  await expect(menu).toBeHidden();
  await closeBuild(page, 'Build 1');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(popup).toHaveCount(0);
  await expect(page.locator('.build-tab')).toHaveCount(1);
  await expect(menu).toBeVisible();
  await expect(menu.locator('.build-tab [aria-pressed="true"]')).toBeFocused();
});

// Long build names and resizing must keep the confirmation's decision buttons inside a narrow embed.
test('close confirmation stays within narrow and resized viewports', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  await newBuild(page);
  await tabAction(page, 'Rename');
  const rename = page.getByRole('dialog', { name: 'Rename build', exact: true });
  const name = 'A very long build name for testing the confirmation layout and wrapping';
  await rename.getByRole('textbox', { name: 'Build name' }).fill(name);
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await closeBuild(page, name);
  const popup = page.getByRole('dialog', { name: 'Close this build?', exact: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 1440, height: 1000 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(popup).toBeInViewport({ ratio: 1 });
    await expect(popup.getByRole('button', { name: 'Close build', exact: true })).toBeInViewport({ ratio: 1 });
    expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }

  await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.build-tab')).toHaveCount(2);
});

// Validate cancellation, keyboard submission, and focus returning to the switcher that opened the dialog.
test('rename dialog validates names and restores focus to the switcher', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  const strip = page.locator('#build-workspace-tabs');
  const switcher = strip.locator('#build-switcher');
  const dialog = page.getByRole('dialog', { name: 'Rename build', exact: true });
  const input = dialog.getByRole('textbox', { name: 'Build name' });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await tabAction(page, 'Rename');
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
  await expect(switcher).toBeFocused();
  await tabAction(page, 'Rename');
  await expect(input).toHaveValue('Build 1');
  await input.fill('Discard this too');
  await input.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(switcher).toBeFocused();
  await expect(strip.locator('.build-switcher-name')).toHaveText('Build 1');
  await tabAction(page, 'Rename');
  await input.fill('  Alternative <build>  ');
  await input.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(switcher).toBeFocused();
  // Markup in a name is shown as text in both the trigger and its list.
  await expect(strip.locator('.build-switcher-name')).toHaveText('Alternative <build>');
  const menu = await openSwitcher(page);
  await expect(menu.getByRole('button', { name: 'Alternative <build>', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('template tabs reset independently to their loaded build after edits and refresh', async ({ page }) => {
  await openWorkspace(page);
  // Small local assets exercise the menu without depending on a benchmark rotation.
  await page.route('**/data/gw2/builds/mesmer/b-*.json?*', async (route) => {
    const build = await page.evaluate(() => window.professionApp.build);
    await route.fulfill({ json: { ...build, targetArmor: 2400 } });
  });
  await page.route('**/data/gw2/rotations/mesmer/*.json?*', (route) =>
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
  const templateName = await page.locator('.build-tab.is-active button[data-build-tab-action="select"]').textContent();
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.targetArmor = 2600;
    app.build.rotation = [];
    app.changed();
  });
  await selectBuild(page, 'Build 1');
  const originalArmor = await page.evaluate(() => window.professionApp.build.targetArmor);
  expect(originalArmor).not.toBe(2400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);

  // Reset after a reload must use the build's persisted template, even on repeated resets.
  await selectBuild(page, templateName);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('loaded template');
      await dialog.accept();
    });
    await tabAction(page, 'Reset build');
    expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
    expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'wait', durationMs: 10 }]);
    await page.evaluate(() => {
      const app = window.professionApp;
      app.build.targetArmor = 2800;
      app.build.rotation = [];
      app.changed();
    });
  }

  await tabAction(page, 'Duplicate');
  page.once('dialog', (dialog) => dialog.accept());
  await tabAction(page, 'Reset build');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  await selectBuild(page, 'Build 1');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(originalArmor);
});

// Many long-named builds must not widen the strip: one switcher replaces the scrolling tab row.
test('many open builds keep the strip and its menu inside narrow screens', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    for (let index = 0; index < 8; index += 1)
      addBuildTab(window.professionApp, window.professionApp.build, `Alternative build with a long name ${index}`);
  });
  const strip = page.locator('#build-workspace-tabs');
  await expect(strip.locator('.build-switcher-count')).toHaveText('9 open builds');
  const geometry = await strip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport + 1);
  await expect(page.locator('#build-switcher')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.build-tab-new')).toBeInViewport({ ratio: 1 });
  // The list scrolls inside its menu and opens on the build being edited.
  const menu = await openSwitcher(page);
  await expect(menu).toBeInViewport({ ratio: 1 });
  await expect(menu.locator('.build-tab.is-active')).toBeInViewport({ ratio: 1 });
  expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  // Build switching stays reachable alongside navigation after scrolling the editor.
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator('#app > header')).toHaveClass(/simulator-header-scrolled/);
  await expect(strip).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.simulator-view-tabs')).toBeInViewport({ ratio: 1 });
});

// One menu lists the open builds and the actions for the build being edited.
test('switcher menu exposes builds and actions and supports keyboard dismissal', async ({ page }) => {
  await openWorkspace(page);
  const switcher = page.locator('#build-switcher');
  const menu = page.locator('#build-switcher-menu');
  await switcher.focus();
  await page.keyboard.press('Enter');
  for (const name of ['Rename', 'Duplicate', /Save to My Builds/, /Load build/, 'Reset build'])
    await expect(menu.getByRole('button', { name, exact: true })).toBeVisible();
  // The final build cannot be closed, and the menu opens on the build being edited.
  await expect(menu.getByRole('button', { name: 'Close Build 1', exact: true })).toBeDisabled();
  await expect(menu.getByRole('button', { name: 'Build 1', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(switcher).toBeFocused();
  await newBuild(page);
  await selectBuild(page, 'Build 1');
  await expect(menu).toBeHidden();
  await expect(switcher).toBeFocused();
  await tabAction(page, 'Duplicate');
  await expect(page.locator('.build-tab')).toHaveCount(3);
  await expect(page.locator('.build-switcher-name')).toHaveText('Build 1 copy');
  await expect(switcher).toBeFocused();
});

// Loading replaces the build being edited while New continues to create independent builds.
test('Load build replaces the current build and Reset restores only that build', async ({ page }) => {
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
  const switcher = page.locator('#build-switcher');
  const originalId = await page
    .locator('.build-tab [data-build-tab-action="select"]')
    .getAttribute('data-build-tab-id');
  await newBuild(page);
  await selectBuild(page, 'Build 1');
  await tabAction(page, /Load build/);
  const dialog = page.locator('#build-templates-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('.template-load-btn').click();
  await expect(dialog).toBeHidden();
  // Hold the download to verify that dismissal and progress do not wait for the assets.
  await expect(page.locator('.template-load-status')).toContainText('Loading Mirage · Power (Spear)');
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toBeVisible();
  await expect(page.locator('#rotation-timeline .rot-skill:visible')).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(initialArmor);
  await expect(switcher).toBeFocused();
  releaseBuild();
  await expect(page.locator('.template-load-status')).toBeHidden();
  await settled(page);
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toHaveCount(0);
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await expect(switcher).toBeFocused();
  // The label already names its weapons, so the loaded build must not repeat them.
  await expect(page.locator('.build-switcher-name')).toHaveText('Mirage · Power (Spear)');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  // Reset restores this build's loaded template after edits, leaving the blank build independent.
  await page.evaluate(() => {
    window.professionApp.build.targetArmor = 2600;
    window.professionApp.changed();
  });
  await selectBuild(page, 'New build');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(initialArmor);
  // Loading renamed the original build, so return to it by identity before resetting.
  const menu = await openSwitcher(page);
  await menu.locator(`[data-build-tab-action="select"][data-build-tab-id="${originalId}"]`).click();
  page.once('dialog', (dialog) => dialog.accept());
  await tabAction(page, 'Reset build');
  await expect(switcher).toBeFocused();
  expect(await page.evaluate(() => window.professionApp.workspace.activeTabId)).toBe(originalId);
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
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

// Four section links stay readable in a mobile grid and retain keyboard access to the benchmark view.
test('section navigation fits four tools on mobile and desktop', async ({ page }) => {
  await openWorkspace(page);
  const navigation = page.getByRole('navigation', { name: 'Simulator sections' });
  const links = navigation.locator('.simulator-view-tab');
  await expect(links).toHaveText(['Workspace', 'Analysis', 'Gear Optimizer', 'Benchmarks']);

  for (const width of [320, 390, 600, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    // Alternate font metrics catch clipping without depending on the host's default font.
    for (const font of ['inherit', 'Arial', 'Verdana']) {
      await navigation.evaluate((element, font) => (element.style.fontFamily = font), font);
      const tabs = await links.evaluateAll((elements) =>
        elements.map((element) => {
          const { top, left, right } = element.getBoundingClientRect();
          return { top, left, right, fits: element.scrollWidth <= element.clientWidth };
        })
      );
      const context = `${width}px ${font}: ${JSON.stringify(tabs)}`;
      expect(new Set(tabs.map(({ top }) => top)).size, context).toBe(width <= 600 ? 2 : 1);
      expect(tabs[0].top, context).toBe(tabs[1].top);
      expect(tabs[2].top, context).toBe(tabs[3].top);
      expect(
        tabs.every(({ left, right, fits }) => left >= 0 && right <= width && fits),
        context
      ).toBe(true);
    }
  }

  await page.setViewportSize({ width: 320, height: 844 });
  const benchmarks = navigation.getByRole('link', { name: 'Benchmarks', exact: true });
  await navigation.getByRole('link', { name: 'Gear Optimizer', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(benchmarks).toBeFocused();
  await expect(benchmarks).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Enter');
  await expect(benchmarks).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#benchmarks-view')).toBeVisible();
  await expect(page.locator('#header-dps')).toBeHidden();
  const workspace = navigation.getByRole('link', { name: 'Workspace', exact: true });
  await workspace.focus();
  await page.keyboard.press('Enter');
  await expect(workspace).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
  await expect(page.locator('#header-dps')).toBeVisible();
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
      addBuildTab(
        window.professionApp,
        window.professionApp.build,
        `Alternative build with a long weapon and variant name ${index}`
      );
  });
  for (const width of [1100, 700, 390, 320, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    // Embedded headers keep both rows visible as the header wraps at each width.
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator('#app > header')).toHaveClass(/simulator-header-scrolled/);
    await expect(page.locator('#build-workspace-tabs')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.simulator-view-tabs')).toBeInViewport({ ratio: 1 });
    const mobile = width <= 600;
    // File actions stay explicit buttons at every width instead of collapsing into an overflow menu.
    for (const id of ['btn-export-build', 'btn-import-build'])
      await expect(page.locator(`.build-toolbar-actions > #${id}`)).toBeInViewport({ ratio: 1 });
    // Six open builds never give the strip a horizontal scrollbar.
    expect(
      await page.locator('#build-workspace-tabs').evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
    const trigger = page.locator('#build-switcher');
    await trigger.click();
    const menu = page.locator('#build-switcher-menu');
    await expect(menu).toBeInViewport({ ratio: 1 });
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
    const actions = await page.locator('#btn-export-build').boundingBox();
    const switcher = await trigger.boundingBox();
    // DPS stays beside the active build even when its name truncates on a phone.
    const dps = page.locator('#build-workspace-tabs > #header-dps');
    await expect(dps).toBeInViewport({ ratio: 1 });
    const result = await dps.boundingBox();
    expect(result.x - (switcher.x + switcher.width)).toBeCloseTo(8, 0);
    expect(Math.abs(result.y + result.height / 2 - (switcher.y + switcher.height / 2))).toBeLessThan(2);
    expect(await dps.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(Math.abs(newButton.y - actions.y)).toBeLessThan(2);
    // Wide strips center the actions on the switcher's row; narrow strips stack them beneath it.
    if (mobile) expect(newButton.y).toBeGreaterThanOrEqual(switcher.y + switcher.height);
    else expect(Math.abs(newButton.y + newButton.height / 2 - (switcher.y + switcher.height / 2))).toBeLessThan(2);
  }

  // Help may wrap with wider system fonts; preserve the header's gap in the actual direction of flow.
  for (const width of [700, 1100, 1600]) {
    await page.setViewportSize({ width, height: 844 });
    const nav = await page.locator('.simulator-view-tabs').boundingBox();
    const switcher = await page.locator('#build-switcher').boundingBox();
    const help = await page.locator('.community-actions').boundingBox();
    expect(nav.x).toBe(switcher.x);
    const wrapped = help.y >= nav.y + nav.height;
    if (width === 700) expect(wrapped).toBe(true);
    if (width === 1600) expect(wrapped).toBe(false);
    if (wrapped) expect(help.y - (nav.y + nav.height)).toBeGreaterThanOrEqual(8);
    else expect(help.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(24);
  }
});

// Both export buttons accept custom names without losing JSON extensions or cancellation.
test('build and rotation exports allow custom file names', async ({ page }) => {
  await openWorkspace(page);
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  const dialog = page.getByRole('dialog', { name: 'Export file', exact: true });
  const input = dialog.getByRole('textbox', { name: 'File name', exact: true });
  for (const kind of ['build', 'rotation']) {
    const button = page.locator(`#btn-export-${kind}`);
    await button.click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    await button.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    // Node covers filename normalization; each real button still has to produce a download.
    await button.click();
    await expect(input).toHaveValue(`mesmer-${kind}.json`);
    await expect(input).toBeFocused();
    await input.fill(`  My ${kind}  `);
    const download = page.waitForEvent('download');
    await input.press('Enter');
    expect((await download).suggestedFilename()).toBe(`My ${kind}.json`);
    await expect(dialog).toHaveCount(0);
  }

  expect(downloads).toHaveLength(2);
});

// Reparented controls keep their original listeners, and destructive actions still allow cancellation.
test('narrow strip exports, imports, resets, and closes builds', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 844 });
  const original = await page.evaluate(() => structuredClone(window.professionApp.build));
  const download = page.waitForEvent('download');
  await page.locator('#btn-export-build').click();
  const exportDialog = page.getByRole('dialog', { name: 'Export file', exact: true });
  await expect(exportDialog).toBeInViewport({ ratio: 1 });
  await exportDialog.getByRole('textbox', { name: 'File name', exact: true }).fill('My mobile build');
  await exportDialog.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('My mobile build.json');
  await page.locator('#btn-import-build').click();
  const importDialog = page.locator('.build-file-import-dialog');
  await expect(importDialog).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await importDialog.getByRole('button', { name: 'Browse files', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'build.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...original, targetArmor: 2400 }))
  });
  const apply = importDialog.locator('[data-build-file-apply]');
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(importDialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  page.once('dialog', (dialog) => dialog.dismiss());
  await tabAction(page, 'Reset build');
  expect(await page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
  page.once('dialog', (dialog) => dialog.accept());
  await tabAction(page, 'Reset build');
  await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(original.targetArmor);
  await newBuild(page);
  await closeBuild(page, 'New build');
  await page
    .getByRole('dialog', { name: 'Close this build?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.locator('.build-tab')).toHaveCount(2);
  await closeBuild(page, 'New build');
  await page
    .getByRole('dialog', { name: 'Close this build?' })
    .getByRole('button', { name: 'Close build', exact: true })
    .click();
  await expect(page.locator('.build-tab')).toHaveCount(1);
  // The menu stays open on the remaining build, whose close control is unavailable.
  const menu = page.locator('#build-switcher-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Close Build 1', exact: true })).toBeDisabled();
  await expect(menu.getByRole('button', { name: 'Build 1', exact: true })).toBeFocused();
});
