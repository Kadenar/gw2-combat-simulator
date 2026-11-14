import { expect, test } from '@playwright/test';

import { mockGw2Icons } from '#tests/helpers/browser-icons.js';

test.beforeEach(async ({ page }) => {
  await mockGw2Icons(page);
});

// A narrow embedded optimizer must collapse its artwork even inside a wide browser window.
test('preview responds to panel width without cropping the artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/revenant.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const panel = page.locator('#gear-optimizer');
  const preview = panel.locator('.optimizer-preview');
  const portrait = preview.locator('.optimizer-preview-portrait');
  await expect(portrait).toBeVisible();
  await expect(portrait.locator('img')).toHaveCSS('object-fit', 'contain');
  const bounds = await portrait.boundingBox();
  expect(bounds.height).toBeCloseTo(bounds.width, 0);

  for (const width of [1096, 620, 390]) {
    await panel.evaluate((element, width) => (element.style.width = `${width}px`), width);
    await expect(portrait).toBeHidden();
    expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const equipment = await preview.locator('.optimizer-preview-equipment').boundingBox();
    const details = await preview.locator('.optimizer-preview-details').boundingBox();

    if (width > 650) {
      expect(details.y).toBeCloseTo(equipment.y, 0);
      expect(details.x).toBeGreaterThanOrEqual(equipment.x + equipment.width);
    } else {
      expect(details.y).toBeGreaterThanOrEqual(equipment.y + equipment.height);
    }
  }
});

// Switching builds clears results, restores current gear, and terminates an outgoing search.
test('build switches discard optimizer results and active searches', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  const panel = page.locator('#gear-optimizer');
  const preview = panel.locator('[data-role="optimizer-preview"]');
  const currentFood = await page.evaluate(() => window.professionApp.build.food);
  await expect(preview.getByRole('heading', { name: 'Current gear', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText(currentFood);
  await expect(preview).toContainText('Click a result row to preview its gear and stats.');
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.request)).toBeNull();
  // Use the canonical skill ID to enable optimization with a valid rotation; a blank build disables it again.
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeDisabled();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall', { skillId: 69311 }));
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeEnabled();
  await addChoice(panel, 'food', '');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await panel.getByRole('row', { name: 'Equipped setup', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-preview"]')).toBeVisible();

  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: 'New blank build', exact: true }).click();
  await page.evaluate(() => {
    window.professionApp.build.food = '';
    window.professionApp.changed();
  });
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  await expect(panel.locator('[data-role="optimizer-results"]')).toBeEmpty();
  await expect(preview.getByRole('heading', { name: 'Current gear', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await expect(panel.locator('.optimizer-feedback')).toBeHidden();
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.request)).toBeNull();

  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeDisabled();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall', { skillId: 69311 }));
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');

  // Start and switch in one task so cancellation does not depend on worker speed.
  expect(
    await page.evaluate(() => {
      document.querySelector('#gear-optimizer form').requestSubmit();
      const app = window.professionApp;
      const running = app.gearOptimizerRunner.isRunning;
      document.querySelector('.build-tab:not(.is-active) [data-build-tab-action="select"]').click();
      return { running, stopped: !app.gearOptimizerRunner.isRunning, status: app.gearOptimizerRunner.state.status };
    })
  ).toEqual({ running: true, stopped: true, status: 'idle' });
  await expect(panel.locator('[data-role="optimizer-results"]')).toBeEmpty();
  await expect(preview.getByRole('heading', { name: 'Current gear', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText(currentFood);
  await expect(panel.locator('.optimizer-feedback')).toBeHidden();
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
});

// The optimizer must initialize and run comparisons without an Analysis host or renderer.
test('optimizer works without the Analysis results container', async ({ page }) => {
  await page.route('**/mesmer.html', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<div id="rotation-results" class="rotation-results"></div>', '');
    await route.fulfill({ response, body });
  });
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#rotation-results')).toHaveCount(0);
  await expect(page.locator('#app > #gear-optimizer-view')).toHaveCount(1);
  for (let index = 0; index < 3; index++) {
    await page.locator('.pal-skill[data-skill="Bladecall"]').click();
    await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  }

  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  await expect(page.locator('#gear-optimizer form')).toBeVisible();
  const comparison = page.locator('#optimizer-relic-comparison');
  await comparison.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(comparison.locator('[data-role="relic-comparison-chart"]')).toBeVisible();
});

// The dedicated route owns both tools and can run a relic graph without ever mounting Analysis.
test('gear optimizer tab owns relic comparison and restores through browser history', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const tab = page.getByRole('link', { name: 'Gear Optimizer', exact: true });
  await expect(tab).toHaveAttribute('aria-current', 'page');
  const strip = page.locator('#build-workspace-tabs');
  await expect(strip).toBeVisible();
  await expect(page.locator('#app > header #build-workspace-tabs')).toBeVisible();
  await expect(strip.locator('#btn-export-build')).toBeVisible();
  await expect(strip.locator('#btn-import-build')).toBeVisible();
  await expect(page.locator('#gear-optimizer form')).toBeVisible();
  await expect(page.locator('#gear-optimizer-view > .optimizer-view-heading, #gear-optimizer > summary')).toHaveCount(
    0
  );
  await expect(page.locator('#rotation-results')).toBeHidden();
  await expect(page.locator('#optimizer-relic-comparison')).toBeEmpty();
  await page
    .getByRole('navigation', { name: 'Simulator sections' })
    .getByRole('link', { name: 'Golem', exact: true })
    .click();
  for (let index = 0; index < 3; index++) {
    await page.locator('.pal-skill[data-skill="Bladecall"]').click();
    await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  }

  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  await tab.click();
  const comparison = page.locator('#optimizer-relic-comparison');
  await expect(comparison.getByRole('button', { name: 'Comparison relic', exact: true })).toBeVisible();
  await comparison.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(comparison.locator('[data-role="relic-comparison-chart"]')).toBeVisible();
  await page.getByRole('link', { name: 'Golem Analysis', exact: true }).click();
  await expect(page.locator('#gear-optimizer-view')).toBeHidden();
  await expect(page.locator('#rotation-results .relic-cmp')).toHaveCount(0);
  await page.goBack();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expect(comparison.locator('[data-role="relic-comparison-chart"]')).toBeVisible();
  // Switching to a blank build removes the previous build's comparison without leaving the optimizer.
  await strip.locator('.build-tab-new').click();
  await page.getByRole('button', { name: 'New blank build', exact: true }).click();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expect(comparison).toBeEmpty();
});

/** Pick by the underlying equipment identity while the dropdown supplies readable attribute descriptions. */
async function addChoice(panel, label, choice) {
  const trigger = panel.getByRole('button', { name: `Add ${label}`, exact: true });
  await trigger.click();
  await trigger
    .locator('..')
    .getByRole('option')
    .filter({
      has: panel.page().getByText(choice || 'None', { exact: true })
    })
    .click();
}

// Real module workers exercise the selected exhaustive search and Apply through the normal persisted build editor.
test('optimizer runs on demand, verifies candidates, and applies equipment once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-picker="prefixes"] label, [data-picker="infusionStats"] label')).toHaveCount(0);
  for (const set of [1, 2]) {
    for (const slot of [1, 2])
      await expect(panel.locator(`[data-picker="sigil${set}-${slot}"] label`)).toHaveText(`Sigil ${slot}`);
  }

  const currentFood = await page.evaluate(() => window.professionApp.build.food);
  await panel.getByRole('button', { name: `Remove ${currentFood} from food`, exact: true }).click();
  await addChoice(panel, 'food', '');
  // Equipment choices use removable chips; scenario settings may use ordinary checkboxes.
  await expect(panel.locator('[data-picker] input[type="checkbox"]')).toHaveCount(0);
  await expect(panel.locator('select[multiple]')).toHaveCount(0);
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Ready to run.');
  const before = await page.evaluate(() => ({
    revision: window.professionApp.analysis.state.buildRevision,
    rotation: window.professionApp.build.rotation,
    weapons: window.professionApp.build.weapons
  }));
  await panel.getByRole('combobox', { name: 'Search', exact: true }).selectOption('exact');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Complete', { timeout: 20000 });
  await expect(panel.locator('[data-role="optimizer-counts"]')).toContainText('1 / 1 candidates checked');
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.');
  await expect(panel.locator('tbody tr')).toHaveCount(1);
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.getByRole('columnheader', { name: 'Apply', exact: true })).toHaveCount(0);
  await expect(panel.locator('[data-apply]')).toHaveCount(0);
  await expect(results.locator('details')).toHaveCount(0);
  // Each result compares with the equipped setup in its own column: the DPS difference and the percentage.
  const comparison = await page.evaluate(() => {
    const state = window.professionApp.gearOptimizerRunner.state;
    const delta = state.winners[0].score.dps - state.baseline.dps;
    const percent = (state.winners[0].score.dps / state.baseline.dps - 1) * 100;
    return [`${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`, `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`];
  });
  await expect(results.locator('tbody .optimizer-gain strong')).toHaveText(comparison[0]);
  await expect(results.locator('tbody .optimizer-gain small')).toHaveText(comparison[1]);
  await expect(results.getByRole('columnheader', { name: 'vs equipped', exact: true })).toBeVisible();

  await expect(results.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  await expect(results.getByRole('columnheader', { name: 'Helm', exact: true })).toBeVisible();
  // Group headers span their columns; weapon names say which hand each prefix fills.
  await expect(results.locator('thead th[scope="colgroup"]')).toHaveText([
    'Cumulative DPS',
    'Armor',
    'Trinkets',
    'Weapons',
    'Infusions'
  ]);
  expect(
    await results
      .locator('thead th[scope="colgroup"]')
      .evaluateAll((headers) => headers.slice(0, 4).map(({ colSpan }) => colSpan))
  ).toEqual([4, 6, 6, 3]);
  for (const name of ['Dagger MH', 'Sword OH', 'Spear 2H'])
    await expect(results.getByRole('columnheader', { name, exact: true })).toBeVisible();
  // Two-line weapon names stay inside the same header row as the other column labels.
  const labelPositions = await results
    .locator('th[scope="col"]')
    .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().bottom));
  expect(Math.max(...labelPositions) - Math.min(...labelPositions)).toBeLessThan(1);

  // Upgrades no result changes are named once above the table instead of filling columns.
  await expect(panel.locator('.optimizer-shared li').filter({ hasText: 'Spear sigils' })).toBeVisible();
  await expect(results.getByRole('columnheader', { name: 'Set 2 sigils', exact: true })).toHaveCount(0);
  // Row selection inspects an isolated candidate; changing preview sets must never save or equip it.
  const equippedBuild = await page.evaluate(() => JSON.stringify(window.professionApp.build));
  await results.locator('tbody tr').first().getByRole('cell', { name: 'Food: None', exact: true }).click();
  const preview = panel.locator('[data-role="optimizer-preview"]');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Apply gear', exact: true })).toBeEnabled();
  await expect(preview.getByRole('heading', { name: 'Result character', exact: true })).toBeVisible();
  await expect(results.locator('tbody tr').first()).toHaveClass(/optimizer-selected/);
  await expect(results.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(results.locator('tbody tr').first().getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  const selectedBackground = await results
    .locator('tbody .optimizer-selected td')
    .first()
    .evaluate((cell) => getComputedStyle(cell).backgroundColor);
  // Visible slot labels and section headings keep the reference layout readable alongside equipment icons.
  const armor = preview.getByRole('region', { name: 'Armor', exact: true });
  await expect(armor.locator('.optimizer-preview-item-icon')).toHaveCount(6);
  await expect(armor.getByRole('group', { name: /^Helm:/ }).locator('.optimizer-preview-item-icon')).toHaveAttribute(
    'src',
    'https://render.guildwars2.com/file/AD7849A39265D6AA1C712ACD476E912E1EC30839/699210.png'
  );
  await expect(armor.getByText('Helm', { exact: true })).toBeVisible();
  await expect(armor.getByRole('heading', { name: 'Armor', exact: true })).toBeVisible();
  const secondSet = preview.getByRole('group', { name: 'Weapon set 2', exact: true });
  await expect(secondSet.locator('.optimizer-preview-item-icon')).toHaveCount(1);
  await expect(secondSet.locator('.optimizer-preview-upgrade')).toHaveCount(2);
  await expect(secondSet.getByRole('heading', { name: 'Weapon set 2', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await expect(preview.locator('.attr-row').filter({ hasText: /^Power/ })).toBeVisible();
  // Match the profession-scoped source artwork and its bundled URL so the preview check works in both builds.
  await expect(preview.locator('.optimizer-preview-portrait img')).toHaveAttribute(
    'src',
    /\/(?:images\/professions\/mesmer\/virtuoso|assets\/virtuoso-[\w-]+)\.png$/
  );
  await expect
    .poll(() => preview.locator('.optimizer-preview-portrait img').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  // Desktop keeps artwork between the equipment and stats, with all six trinkets on one row.
  const equipmentBounds = await preview.locator('.optimizer-preview-equipment').boundingBox();
  const portraitBounds = await preview.locator('.optimizer-preview-portrait').boundingBox();
  const detailsBounds = await preview.locator('.optimizer-preview-details').boundingBox();
  expect(portraitBounds.x).toBeGreaterThanOrEqual(equipmentBounds.x + equipmentBounds.width);
  expect(detailsBounds.x).toBeGreaterThanOrEqual(portraitBounds.x + portraitBounds.width);
  expect(portraitBounds.height).toBeCloseTo(portraitBounds.width, 0);
  const trinketRows = await preview
    .locator('.optimizer-preview-trinkets .optimizer-preview-item')
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(new Set(trinketRows).size).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await preview.getByRole('combobox', { name: 'Preview weapon set', exact: true }).selectOption('2');
  await expect(preview.getByRole('button', { name: 'Apply gear', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(equippedBuild);
  await results.getByRole('row', { name: 'Equipped setup', exact: true }).focus();
  await page.keyboard.press('Enter');
  // Selecting the pinned equipped row uses the same preview highlight and offers nothing to apply.
  await expect(results.locator('tbody .optimizer-selected')).toHaveCount(0);
  await expect(results.locator('thead .optimizer-selected')).toHaveAttribute('aria-current', 'true');
  await expect(results.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
  expect(
    await results
      .locator('thead .optimizer-selected td')
      .first()
      .evaluate((cell) => getComputedStyle(cell).backgroundColor)
  ).toBe(selectedBackground);
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText(currentFood);
  await expect(preview.getByRole('button', { name: 'Apply gear', exact: true })).toHaveCount(0);
  await results.locator('tbody tr').first().focus();
  await page.keyboard.press('Space');
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await preview.getByRole('button', { name: 'Apply gear', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  const after = await page.evaluate(() => ({
    revision: window.professionApp.analysis.state.buildRevision,
    rotation: window.professionApp.build.rotation,
    weapons: window.professionApp.build.weapons,
    food: window.professionApp.build.food
  }));
  expect(after).toEqual({ ...before, revision: before.revision + 1, food: '' });
  await expect(panel.locator('[data-apply], [data-apply-row]')).toHaveCount(0);
  // With the only result applied, no row changes food, so the strip names the newly equipped choice.
  await expect(panel.locator('.optimizer-shared li').filter({ hasText: 'Food' })).toContainText('None');
});

test('prepopulated choices enforce limits and stay usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  const prefixes = panel.getByRole('button', { name: 'Add prefixes', exact: true });
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  await expect(prefixes).toBeDisabled();
  await panel.getByRole('button', { name: "Remove Viper's from prefixes", exact: true }).click();
  await expect(prefixes).toBeEnabled();
  await addChoice(panel, 'infusion stats', 'Condition Damage');
  const infusionSelect = await panel.getByRole('button', { name: 'Add infusion stats', exact: true }).boundingBox();
  const infusionCount = await panel.getByRole('spinbutton', { name: 'Total infusions', exact: true }).boundingBox();
  expect(Math.abs(infusionSelect.y - infusionCount.y)).toBeLessThan(1);
  expect(infusionSelect.height).toBe(infusionCount.height);
  await expect(panel.locator('[data-role="optimizer-estimate"]')).toContainText('Fast samples and refines candidates');
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

// Presentation tests use a completed four-candidate search; real workers remain covered by run/apply and cancellation.
async function showOptimizerResults(page) {
  await page.evaluate(async () => {
    const { captureGearOptimizerRequest, optimizerEquipment } =
      await import('/js/games/gw2/app/optimizer/gear/search.ts');
    const { renderGearOptimizer } = await import('/js/games/gw2/app/optimizer/gear/panel.ts');
    const app = window.professionApp;
    const runner = app.gearOptimizerRunner;
    const request = captureGearOptimizerRequest(app, { food: ['', app.build.food], utility: ['', app.build.utility] });
    const equipment = optimizerEquipment(request.build);
    const baseline = {
      dps: 1000,
      rankingDps: 1000,
      totalDamage: 1000,
      effectiveDamage: 1000,
      healthCheckpoints: null,
      dpsStartTime: 0,
      dpsWindow: 1,
      rotationEndTime: 1,
      observationEndTime: 1,
      combatEndTime: 1,
      warnings: []
    };
    const winners = [{ food: '', utility: '' }, { food: '' }, { utility: '' }, {}].map((changes, index) => ({
      key: String(index),
      equipment: { ...structuredClone(equipment), ...changes },
      score: { ...baseline, dps: 1030 - index * 10, rankingDps: 1030 - index * 10 },
      representedCombinationCount: '1'
    }));
    runner.request = request;
    Object.assign(runner.state, {
      status: 'complete',
      count: 4n,
      completed: 4n,
      baseline,
      winners,
      groups: {
        all: winners,
        sigils: [winners[0]],
        rune: [winners[0]],
        relic: [winners[0]],
        food: [winners[0], winners[2]],
        utility: [winners[0], winners[1]]
      }
    });
    renderGearOptimizer(app);
  });
}

// Render candidate changes in the visible grid and keep it scrollable on mobile.
test('results expose every equipment choice without expanding rows', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    window.professionApp.build.infusions = [{ stat: 'Condition Damage', count: 18 }];
  });
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  const equipped = await page.evaluate(() => ({
    food: window.professionApp.build.food,
    utility: window.professionApp.build.utility,
    rune: window.professionApp.build.rune,
    relic: window.professionApp.build.relic,
    prefixes: [...new Set(Object.values(window.professionApp.build.gear))],
    weaponSigils: window.professionApp.build.weaponSigils
  }));
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  for (const key of ['rune', 'relic']) await expect(panel.locator(`input[name="${key}"]`)).toHaveValue(equipped[key]);
  expect(
    await panel.locator('input[name="prefixes"]').evaluateAll((inputs) => inputs.map((input) => input.value))
  ).toEqual(equipped.prefixes);
  for (const [set, sigils] of equipped.weaponSigils.entries()) {
    for (const [slot, sigil] of sigils.entries())
      await expect(panel.locator(`input[name="sigil${set + 1}-${slot + 1}"]`)).toHaveValue(sigil);
  }

  for (const key of ['food', 'utility']) {
    await expect(panel.locator(`input[name="${key}"]`)).toHaveValue(equipped[key]);
  }

  await showOptimizerResults(page);
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.locator('tbody tr')).toHaveCount(3);
  await expect(results.locator('details')).toHaveCount(0);
  await expect(results.getByRole('cell', { name: 'Malign infusions: 18', exact: true }).first()).toBeVisible();
  await expect(results.getByRole('cell', { name: 'Food: None', exact: true }).first()).toBeVisible();
  // Upgrades that vary keep icon columns; unchanged ones move to the shared strip with their icons.
  for (const key of ['food', 'utility']) {
    const icon = results
      .getByRole('cell', { name: `${key[0].toUpperCase() + key.slice(1)}: ${equipped[key]}`, exact: true })
      .first()
      .locator('img');
    await expect(icon).toHaveAttribute('alt', equipped[key]);
    await expect(icon).toHaveAttribute('src', /^https:\/\/render\.guildwars2\.com\/file\//);
  }

  const rune = panel.locator('.optimizer-shared li').filter({ hasText: 'Rune' });
  await expect(rune).toContainText(equipped.rune);
  await expect(rune.locator('img')).toHaveAttribute('src', /^https:\/\/render\.guildwars2\.com\/file\//);
  await expect(results.getByRole('columnheader', { name: 'Rune', exact: true })).toHaveCount(0);

  await expect(panel.locator('[data-role="optimizer-counts"]')).not.toContainText('raw assignments');
  await panel
    .locator('[data-role="optimizer-results"]')
    .evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 120));
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  // Exercise wider text metrics as well as the host defaults; desktop fit must not depend on Segoe UI.
  await results.evaluate((table) => {
    table.style.fontFamily = 'Verdana, sans-serif';
    table.style.setProperty('--mono', '"Courier New", monospace');
    table.style.letterSpacing = '1px';
  });
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  await results.evaluate((table) => table.removeAttribute('style'));
  await page.setViewportSize({ width: 390, height: 844 });
  await panel
    .locator('[data-role="optimizer-results"]')
    .evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 120));
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)
  ).toBe(true);
  // Scores stay visible at both ends of the mobile equipment scroll; Apply appears only on a previewed row.
  for (const end of [false, true]) {
    await panel.locator('.optimizer-table-scroll').evaluate((element, end) => {
      element.scrollLeft = end ? element.scrollWidth : 0;
    }, end);
    await expect(results.locator('tbody .optimizer-damage strong').first()).toBeInViewport();
  }

  await expect(results.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
});

test('result groupings switch without rerunning and keep equipped gear pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  const equipped = await page.evaluate(() => ({
    food: window.professionApp.build.food,
    rune: window.professionApp.build.rune,
    sigils: window.professionApp.build.weaponSigils[0]
  }));
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await showOptimizerResults(page);
  const before = await page.evaluate(() => ({
    simulations: String(window.professionApp.gearOptimizerRunner.state.simulations),
    revision: window.professionApp.analysis.state.buildRevision
  }));
  const pinned = panel.locator('thead').getByRole('row', { name: 'Equipped setup', exact: true });
  await expect(pinned.getByRole('cell', { name: `Food: ${equipped.food}`, exact: true })).toBeVisible();
  await expect(pinned.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
  // Only food and utility had alternatives in this search, so sigil, rune, and relic groupings are not offered.
  const groupings = panel.getByRole('group', { name: 'Group results', exact: true });
  await expect(groupings.getByRole('button')).toHaveText(['Top results', 'Per upgrade set', 'Per food', 'Per utility']);
  for (const [label, count] of [
    ['Per upgrade set', 3],
    ['Per food', 2],
    ['Per utility', 2],
    ['Top results', 3]
  ]) {
    await groupings.getByRole('button', { name: label, exact: true }).click();
    await expect(groupings.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('tbody tr')).toHaveCount(count);
    await expect(pinned).toBeVisible();
    const equippedCells = await pinned
      .locator('.optimizer-equipment')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')).join('|'));
    const resultCells = await panel
      .locator('tbody tr')
      .evaluateAll((rows) =>
        rows.map((row) =>
          [...row.querySelectorAll('.optimizer-equipment')].map((cell) => cell.getAttribute('aria-label')).join('|')
        )
      );
    expect(resultCells).not.toContain(equippedCells);
  }

  expect(
    await page.evaluate(() => ({
      simulations: String(window.professionApp.gearOptimizerRunner.state.simulations),
      revision: window.professionApp.analysis.state.buildRevision
    }))
  ).toEqual(before);
  // The equipped row closes the sticky header, directly under the column labels, at both scroll ends.
  const scroll = panel.locator('.optimizer-table-scroll');
  await scroll.evaluate((element) => {
    element.style.maxHeight = '160px';
  });
  for (const bottom of [false, true]) {
    await scroll.evaluate((element, bottom) => {
      element.scrollTop = bottom ? element.scrollHeight : 0;
    }, bottom);
    const bounds = await scroll.boundingBox();
    const labels = await panel.locator('thead tr').nth(1).boundingBox();
    const row = await pinned.locator('td').first().boundingBox();
    expect(Math.abs(row.y - (labels.y + labels.height))).toBeLessThan(0.5);
    expect(row.y + row.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }

  await scroll.evaluate((element) => element.style.removeProperty('max-height'));
  // Groupings wrap inside a phone-width panel, and the previewed row's Apply stays reachable.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await groupings.getByRole('button', { name: 'Per food', exact: true }).click();
  const withoutFood = panel
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: 'Food: None', exact: true }) });
  await withoutFood.locator('.optimizer-damage strong').click();
  await withoutFood.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.food)).toBe('');
  expect(await page.evaluate(() => window.professionApp.analysis.state.buildRevision)).toBe(before.revision + 1);
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.');
  await expect(pinned.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  const nextResult = panel
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: `Food: ${equipped.food}`, exact: true }) });
  await nextResult.locator('.optimizer-damage strong').click();
  await nextResult.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.food)).toBe(equipped.food);
  expect(await page.evaluate(() => window.professionApp.analysis.state.buildRevision)).toBe(before.revision + 2);
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.');
  await expect(pinned.getByRole('cell', { name: `Food: ${equipped.food}`, exact: true })).toBeVisible();
  expect(await page.evaluate(() => String(window.professionApp.gearOptimizerRunner.state.simulations))).toBe(
    before.simulations
  );
  // A real rotation edit still invalidates the retained search, even after successive equipment applies.
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation.push(structuredClone(app.build.rotation[0]));
    app.changed();
  });
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Results are stale');
  await page.waitForFunction(() => window.professionApp.analysis.state.simulationStatus === 'idle');
  await withoutFood.locator('.optimizer-damage strong').click();
  await expect(panel.getByRole('button', { name: 'Apply gear', exact: true })).toBeDisabled();
  await expect(withoutFood.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
});

// Component styles must keep hidden controls out of layout on narrow hosts.
test('relic comparison controls survive a narrow host', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(() => {
    document.body.innerHTML = '<div class="build-templates"></div>';
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    const { mountRelicComparison } = await import('/js/games/gw2/app/optimizer/relic-comparison/panel.ts');
    const host = document.createElement('div');
    host.dataset.layoutFixture = 'relic-comparison';
    host.style.width = '350px';
    document.body.append(host);
    mountRelicComparison(host, {
      relicComparisonAvailable: true,
      relicComparisonTarget: 'Fireworks',
      relicComparisonTargets: ['Fireworks', 'Thorns', 'Nourys']
    });
  });
  const comparison = page.locator('[data-layout-fixture="relic-comparison"] .relic-cmp');
  const relicSelect = comparison.locator('select[data-role="relic-comparison-target"]');
  await expect(relicSelect.locator('optgroup')).toHaveCount(3);
  await expect(comparison.locator('[data-role="relic-comparison-stacks-control"]')).toBeHidden();
  await expect(comparison.getByRole('button', { name: 'Run comparison' })).toBeEnabled();
  expect(await comparison.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
