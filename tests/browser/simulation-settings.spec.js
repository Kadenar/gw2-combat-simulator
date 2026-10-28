import { expect, test } from '@playwright/test';

import { openSimulator } from '#tests/helpers/browser-workspace.js';

// Native target and delay edits must preserve row layout through worker results, including swaps after target death.
test('weapon-swap line breaks survive settings that end combat before the remaining rotation', async ({ page }) => {
  await page.goto('/warrior.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build = app.adapter.toApplicationBuild({
      ...app.profession.createBuildDefaults(),
      weapons: ['Axe', ''],
      alternateWeapons: ['Axe', ''],
      startingWeaponSet: 1,
      targetHealth: 0,
      rotation: [
        { type: 'combat-start' },
        { type: 'cast', skillId: app.activeCatalog.skillsById.get(14369).id },
        { type: 'wait', durationMs: 1000 },
        { type: 'cast', skillId: app.activeCatalog.skillsById.get(-3).id },
        { type: 'wait', durationMs: 10000 },
        { type: 'cast', skillId: app.activeCatalog.skillsById.get(-3).id },
        { type: 'wait', durationMs: 1000 }
      ]
    });
    app.changed();
  });
  const assertRows = async () => {
    await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
    await expect(page.locator('#rotation-timeline > .rot-row')).toHaveCount(3);
    const positions = await page.locator('#rotation-timeline > .rot-row').evaluateAll((rows) =>
      rows.map((row) => ({
        top: row.getBoundingClientRect().top,
        indexes: [...row.querySelectorAll('.rot-skill[data-idx]')].map((skill) => Number(skill.dataset.idx))
      }))
    );
    expect(positions.map(({ indexes }) => indexes)).toEqual([[0, 1, 2, 3], [4, 5], [6]]);
    expect(positions[1].top).toBeGreaterThan(positions[0].top);
    expect(positions[2].top).toBeGreaterThan(positions[1].top);
  };

  await assertRows();
  await page.locator('#simulation-settings > summary').click();
  const health = page.locator('#target-hp');
  await health.fill('1');
  await health.press('Tab');
  await assertRows();
  expect(await page.evaluate(() => window.professionApp.results.deathTime)).not.toBeNull();
  const delay = page.locator('#simulation-weaponSwapMs');
  await delay.fill('100');
  await delay.press('Tab');
  await assertRows();
  await health.fill('0');
  await health.press('Tab');
  await assertRows();
});

// A native settings edit must invalidate an inactive tab and let the worker replace both cached comparison results.
test('returning to a cached tab refreshes Current and Reference after a shared delay edit', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = [{ type: 'combat-start' }, { type: 'cast', skillId: -3 }, { type: 'cast', skillId: 73154 }];
    app.changed(false);
  });
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.evaluate(() => {
    const app = window.professionApp;
    app.startRotationComparison();
    app.loadRotationReference(app.build.rotation);
  });
  await page.waitForFunction(() => window.professionApp.rotationComparison?.referenceStatus === 'fresh');
  const cached = await page.evaluateHandle(() => {
    const app = window.professionApp;
    return {
      tabId: app.workspace.activeTabId,
      current: app.results,
      reference: app.rotationComparison.referenceResult
    };
  });
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    const app = window.professionApp;
    addBuildTab(app, app.build, 'Other build');
  });
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.locator('#simulation-settings > summary').click();
  const delay = page.locator('#simulation-weaponSwapMs');
  await delay.fill('1000');
  await delay.press('Tab');
  await page.evaluate(({ tabId }) => window.professionApp.activateBuildTab(tabId), cached);
  await page.waitForFunction(() => {
    const app = window.professionApp;
    return app.simulationStatus === 'idle' && app.rotationComparison?.referenceStatus === 'fresh';
  });
  expect(
    await page.evaluate(({ current, reference }) => {
      const app = window.professionApp;
      return {
        currentReplaced: app.results !== current,
        referenceReplaced: app.rotationComparison.referenceResult !== reference,
        revisionMatches: app.resultRevision === app.buildRevision
      };
    }, cached)
  ).toEqual({ currentReplaced: true, referenceReplaced: true, revisionMatches: true });
  await cached.dispose();
});

// Real controls must survive build switches, imports, reloads, and navigation to another profession.
// Action-tick scheduling and wait overlap are covered by the Node transition-delay contracts.
test('transition delay preferences persist globally and control imported rotation markers', async ({ page }) => {
  const warnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#simulation-settings > summary').click();
  const settings = page.locator('#simulation-transition-delays');
  await expect(settings.getByRole('spinbutton')).toHaveCount(5);
  await settings.getByRole('button', { name: 'Apply 100 ms to all' }).click();
  await expect(page.locator('#simulation-weaponSwapMs')).toHaveValue('100');
  await page.evaluate(async () => {
    const { previewRotationFile, applyRotationImportPreview } =
      await import('/js/games/gw2/app/import-export/rotation-import-dialog.ts');
    const app = window.professionApp;
    const rotation = ['Swap Weapons', { name: '__wait', waitMs: 80 }, 'Swap Weapons'];
    const file = new File([JSON.stringify(rotation)], 'rotation.json', { type: 'application/json' });
    applyRotationImportPreview(app, await previewRotationFile(file, app));
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const importedState = await page.evaluate(() => {
    const app = window.professionApp;
    return {
      warnings: app.results.warnings,
      buildHasSettings: JSON.stringify(app.build).includes('transitionDelays'),
      settings: app.simulationSettings.transitionDelays
    };
  });
  expect(importedState.warnings).toEqual([]);
  expect(importedState.buildHasSettings).toBe(false);
  expect(Object.values(importedState.settings)).toEqual([100, 100, 100, 100, 100]);
  const forced = page.locator('#rotation-timeline .rot-forced-delay');
  await expect(forced).toHaveCount(2);
  await expect(forced.first()).toHaveAttribute('title', /Forced transition delay: 20 ms/);
  await expect(forced.first()).toBeVisible();
  expect(await forced.first().evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe('solid');
  const revision = await page.evaluate(() => window.professionApp.buildRevision);
  await page.getByRole('checkbox', { name: 'Display transition delays', exact: true }).uncheck();
  await expect(forced.first()).toBeHidden();
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(revision);
  // Switch through the real workspace path while preserving the inline settings.
  await page.evaluate(async () => {
    const { addBuildTab } = await import('/js/games/gw2/app/build/state/workspace.ts');
    const app = window.professionApp;
    addBuildTab(app);
  });
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(100);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.weaponSwapMs)).toBe(100);
  expect(await page.locator('html').getAttribute('data-show-transition-delays')).toBe('false');
  await page.goto('/guardian.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.simulationSettings.transitionDelays.forgeEntryMs)).toBe(100);
  await page.locator('#simulation-settings > summary').click();
  await settings.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await settings.getByRole('spinbutton').evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual([
    '0',
    '0',
    '0',
    '0',
    '0'
  ]);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => Object.values(window.professionApp.simulationSettings.transitionDelays))).toEqual([
    0, 0, 0, 0, 0
  ]);
  expect(warnings.filter((message) => message.includes('UNPRESENTED CUSTOM EVENT'))).toEqual([]);
});

// Seed and baseline crit policy belong to the build and survive workspace reloads.
test('simulation seed and critical damage settings persist with the build', async ({ page }) => {
  await page.goto('/elementalist.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#simulation-settings > summary').click();
  const seed = page.getByRole('spinbutton', { name: 'Simulation seed', exact: true });
  const criticalDamage = page.getByRole('combobox', { name: 'Critical damage', exact: true });
  await expect(criticalDamage).toHaveValue('averaged');
  // Show a short mode summary and make the full explanation available by hover, click, and keyboard.
  await expect(page.locator('#critical-damage-help')).toBeVisible();
  await expect(criticalDamage).toHaveAccessibleDescription('Uses expected critical damage for consistent comparisons.');
  const info = page.getByLabel('About critical damage', { exact: true });
  const explanation = page.locator('.critical-damage-description');
  await expect(explanation).toBeHidden();
  await info.hover();
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText('RNG simulations always use Rolled.');
  await criticalDamage.hover();
  await expect(explanation).toBeHidden();
  await info.click();
  await criticalDamage.hover();
  await expect(explanation).toBeVisible();
  await info.press('Escape');
  await expect(explanation).toBeHidden();
  await expect(page.locator('#simulation-settings')).toBeVisible();
  await criticalDamage.focus();
  await info.focus();
  await expect(explanation).toBeVisible();
  await criticalDamage.selectOption('rolled');
  await expect(criticalDamage).toHaveAccessibleDescription('Uses individual critical rolls for each hit.');
  await page.waitForFunction(() => window.professionApp.build.assumptions.criticalDamageMode === 'rolled');
  expect(
    await page.evaluate(
      () =>
        window.professionApp.adapter
          .createBuildContext({
            build: window.professionApp.build,
            transitionDelays: window.professionApp.simulationSettings.transitionDelays,
            patch: window.professionApp.patch
          })
          .simulationConfig().criticalDamageMode
    )
  ).toBe('rolled');
  await expect(seed).toHaveValue('1');
  await seed.fill('3576928633');
  await seed.press('Tab');
  await page.waitForFunction(
    () =>
      window.professionApp.resultRevision === window.professionApp.buildRevision &&
      window.professionApp.results?.randomness.seed === 3576928633
  );
  expect(
    await page.evaluate(() => JSON.parse(JSON.stringify(window.professionApp.build)).assumptions.simulationSeed)
  ).toBe(3576928633);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#simulation-settings > summary').click();
  await expect(seed).toHaveValue('3576928633');
  await expect(criticalDamage).toHaveValue('rolled');
  await page.waitForFunction(() => window.professionApp.results?.randomness.seed === 3576928633);
  await seed.fill('0');
  await seed.press('Tab');
  await page.waitForFunction(
    () =>
      window.professionApp.resultRevision === window.professionApp.buildRevision &&
      window.professionApp.results?.randomness.seed === 0
  );
});

test('simulation config controls and result-dependent palette state work in the browser', async ({ page }) => {
  await openSimulator(page);

  const openConfig = page.locator('#simulation-settings > summary');

  await openConfig.click();
  const config = page.locator('#simulation-settings');

  await expect(config).toBeVisible();
  await expect(config.getByText('Timeline Display', { exact: true })).toBeVisible();
  await expect(config.getByLabel('Display idle time')).toBeVisible();
  await expect(config.getByLabel('Overlay sigils')).toBeVisible();
  await expect(config.getByLabel('Overlay relics')).toBeVisible();
  await expect(config.getByLabel('Overlay Sovereign of Light')).toHaveCount(0);

  await openConfig.click();
  await expect(config.locator('#perma-boons')).toBeHidden();
  await expect(openConfig).toBeFocused();

  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#header-dps')).toHaveAttribute('aria-label', /Current rotation DPS: /);
  await expect(page.locator('[data-role="current-rotation-dps"]')).toHaveCount(0);
});

// Embedded settings use the same native disclosure and retain edits across collapse and resize.
test('embedded simulation settings expand inline on narrow frames', async ({ page }) => {
  await page.goto('/');
  await page.setContent(
    '<iframe title="Simulator" src="/mesmer.html?embed=1" style="width: 800px; height: 600px"></iframe>'
  );
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  const trigger = frame.locator('#simulation-settings > summary');
  const config = frame.locator('#simulation-settings');
  const controls = config.locator('#perma-boons');

  await trigger.focus();
  await trigger.press('Enter');
  await expect(controls).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(frame.locator('dialog[open]')).toHaveCount(0);
  await config.getByLabel('Display idle time').check();
  await trigger.click();
  await expect(controls).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.locator('iframe').evaluate((iframe) => {
    iframe.style.width = '320px';
    iframe.style.height = '400px';
  });
  await trigger.press('Space');
  await expect(config.getByLabel('Display idle time')).toBeChecked();
  expect(await config.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await config.getByLabel('Overlay relics').check();
  await trigger.click();
  await expect(controls).toBeHidden();
  await expect(trigger).toBeFocused();
});

// Settings occupy page space before the builder instead of covering it, and remain hidden in Analysis.
test('simulation settings fit the workspace and hide in Analysis', async ({ page }) => {
  await openSimulator(page);
  const config = page.locator('.rotation-section > #simulation-settings');
  const trigger = config.locator(':scope > summary');
  const controls = config.locator('#perma-boons');

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    await expect(controls).toBeVisible();
    expect(await config.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const expanded = await config.boundingBox();
    const builder = await page.locator('.rotation-panel-shell').boundingBox();
    expect(builder.y).toBeGreaterThanOrEqual(expanded.y + expanded.height);
    await trigger.click();
    await expect(controls).toBeHidden();
    await expect(trigger).toBeFocused();
    expect((await config.boundingBox()).height).toBeLessThan(expanded.height);
  }

  await trigger.click();
  // Isolate Analysis visibility from navigation's separate workspace-reset behavior.
  await page.evaluate(() => {
    document.body.dataset.simulatorView = 'analysis';
  });
  await expect(config).toBeHidden();
});
