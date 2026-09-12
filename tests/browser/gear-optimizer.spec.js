import { expect, test } from '@playwright/test';

// Baseline validation must stop both worker search modes before invalid rotations populate any result group.
test('invalid rotation skills fail optimization without publishing results', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.addRotation('Bladecall');
    app.build.weapons = ['Greatsword', ''];
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const panel = page.locator('#gear-optimizer');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  for (const search of ['fast', 'exact']) {
    if (search === 'exact')
      await page.evaluate(() => {
        const runner = window.professionApp.gearOptimizerRunner;
        runner.run({ ...runner.request, search: 'exact' });
      });
    await expect(panel.locator('[data-role="optimizer-status"]')).toContainText(
      'Fix invalid rotation skills before running the optimizer:',
      { timeout: 20000 }
    );
    await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Bladecall');
    await expect(panel.locator('[data-role="optimizer-results"]')).toBeEmpty();
    await expect(panel.locator('[data-role="optimizer-warnings"]')).toBeEmpty();
    expect(
      await page.evaluate(() => {
        const runner = window.professionApp.gearOptimizerRunner;
        return {
          running: runner.isRunning,
          baseline: runner.state.baseline,
          simulations: String(runner.state.simulations),
          winners: runner.state.winners,
          groups: Object.values(runner.state.groups).flat()
        };
      })
    ).toEqual({ running: false, baseline: null, simulations: '0', winners: [], groups: [] });
  }
});

// Switching builds clears results, restores current gear, and terminates an outgoing search.
test('build switches discard optimizer results and active searches', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const panel = page.locator('#gear-optimizer');
  const preview = panel.locator('[data-role="optimizer-preview"]');
  const currentFood = await page.evaluate(() => window.professionApp.build.food);
  await expect(preview.getByRole('heading', { name: 'Current gear', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText(currentFood);
  await expect(preview).toContainText('Click a result row to preview its gear and stats.');
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.request)).toBeNull();
  // Adding a rotation enables optimization; switching to a blank build disables it again.
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeDisabled();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
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
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await expect(panel.locator('[data-role="optimizer-results"]')).toBeEmpty();
  await expect(preview.getByRole('heading', { name: 'Current gear', exact: true })).toBeVisible();
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await expect(panel.locator('.optimizer-feedback')).toBeHidden();
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.request)).toBeNull();

  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeDisabled();
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');

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
    await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
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
    .getByRole('link', { name: 'Workspace', exact: true })
    .click();
  for (let index = 0; index < 3; index++) {
    await page.locator('.pal-skill[data-skill="Bladecall"]').click();
    await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  }

  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await tab.click();
  const comparison = page.locator('#optimizer-relic-comparison');
  await expect(comparison.getByRole('combobox', { name: 'Comparison relic' })).toBeVisible();
  await comparison.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(comparison.locator('[data-role="relic-comparison-chart"]')).toBeVisible();
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
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

// Optional requirements survive worker updates, reject before combat, and disappear when cleared.
test('optimizer requirement inputs reject candidates and blank fields remove limits', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  for (const label of [
    'Minimum toughness',
    'Maximum toughness',
    'Minimum vitality',
    'Minimum boon duration (%)',
    'Minimum quickness duration (%)'
  ])
    await expect(panel.getByRole('spinbutton', { name: label, exact: true })).toHaveValue('');
  await panel.getByRole('spinbutton', { name: 'Maximum toughness', exact: true }).fill('0');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await expect(panel.locator('[data-role="optimizer-counts"]')).toContainText('0 simulations');
  await expect(panel.locator('[data-role="optimizer-results"]')).toContainText(
    'No gear combinations met the requirements'
  );
  await panel.getByRole('spinbutton', { name: 'Maximum toughness', exact: true }).fill('');
  await panel.getByRole('spinbutton', { name: 'Minimum vitality', exact: true }).fill('100000');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await expect(panel.locator('[data-role="optimizer-counts"]')).toContainText('0 simulations');
  await expect(panel.getByRole('spinbutton', { name: 'Minimum vitality', exact: true })).toHaveValue('100000');
  await panel.getByRole('spinbutton', { name: 'Minimum vitality', exact: true }).fill('');
  await panel.getByRole('spinbutton', { name: 'Minimum boon duration (%)', exact: true }).fill('0');
  await panel.getByRole('spinbutton', { name: 'Minimum quickness duration (%)', exact: true }).fill('0');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  expect(await page.evaluate(() => ({ ...window.professionApp.gearOptimizerRunner.request.selections }))).toMatchObject(
    { minBoonDuration: 0, minQuicknessDuration: 0 }
  );
  expect(await page.evaluate(() => 'maxToughness' in window.professionApp.gearOptimizerRunner.request.selections)).toBe(
    false
  );
  expect(await page.evaluate(() => 'minVitality' in window.professionApp.gearOptimizerRunner.request.selections)).toBe(
    false
  );
  await expect(panel.getByRole('table', { name: 'Gear comparison' })).toBeVisible();
});

// Collapsing slot controls preserves overrides through workers; clearing restores shared prefix choices.
test('forced slots start collapsed and constrain results until cleared', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const panel = page.locator('#gear-optimizer');
  const forced = panel.locator('.optimizer-forced-slots');
  await expect(forced).not.toHaveAttribute('open');
  await expect(forced.getByRole('combobox', { name: 'Helm', exact: true })).toBeHidden();
  await forced.locator('summary').click();
  await forced.getByRole('combobox', { name: 'Helm', exact: true }).selectOption('Celestial');
  await forced.getByRole('combobox', { name: 'Set 2 main hand', exact: true }).selectOption("Assassin's");
  await page.setViewportSize({ width: 390, height: 844 });
  await forced.getByRole('combobox', { name: 'Helm', exact: true }).scrollIntoViewIfNeeded();
  await expect(forced.getByRole('combobox', { name: 'Helm', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await forced.screenshot({ path: '.scratch/optimizer/forced-slots-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await forced.screenshot({ path: '.scratch/optimizer/forced-slots-desktop.png' });
  await forced.locator('summary').click();
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  const result = await page.evaluate(() => {
    const runner = window.professionApp.gearOptimizerRunner;
    return {
      forcedSlots: runner.request.selections.forcedSlots,
      equipment: runner.state.winners.map((entry) => entry.equipment)
    };
  });
  expect(result.forcedSlots).toEqual({ Helm: 'Celestial', AlternateWeapon1: "Assassin's" });
  expect(result.equipment.length).toBeGreaterThan(0);
  for (const equipment of result.equipment) {
    expect(equipment.gear.Helm).toBe('Celestial');
    expect(equipment.alternateWeaponPrefixes[0]).toBe("Assassin's");
  }

  await expect(forced).not.toHaveAttribute('open');
  await forced.locator('summary').click();
  await expect(forced.getByRole('combobox', { name: 'Helm', exact: true })).toHaveValue('Celestial');
  await forced.getByRole('button', { name: 'Clear forced slots', exact: true }).click();
  await expect(forced.getByRole('combobox', { name: 'Helm', exact: true })).toHaveValue('');
  await expect(forced.getByRole('combobox', { name: 'Set 2 main hand', exact: true })).toHaveValue('');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.request.selections.forcedSlots)).toEqual(
    {}
  );
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

// Real module workers exercise snapshot, cancellation and Apply through the normal persisted build editor.
test('optimizer runs on demand, verifies candidates, and applies equipment once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
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
  await expect(panel.locator('form input[type="checkbox"]')).toHaveCount(0);
  await expect(panel.locator('select[multiple]')).toHaveCount(0);
  await panel.screenshot({ path: '.scratch/optimizer/revised-desktop.png' });
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Ready to run.');
  const before = await page.evaluate(() => ({
    revision: window.professionApp.buildRevision,
    rotation: window.professionApp.build.rotation,
    weapons: window.professionApp.build.weapons
  }));
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Complete', { timeout: 20000 });
  await expect(panel.locator('[data-role="optimizer-counts"]')).toContainText('1 candidates checked');
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.');
  await expect(panel.locator('tbody tr')).toHaveCount(1);
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.locator('details')).toHaveCount(0);
  await expect(results.locator('tbody').getByText('Best', { exact: true })).toHaveCount(0);
  await expect(results.locator('tfoot .optimizer-best').getByText('Best', { exact: true })).toBeVisible();
  const percentage = await page.evaluate(() => {
    const state = window.professionApp.gearOptimizerRunner.state;
    return `${((state.winners[0].score.dps / state.baseline.dps - 1) * 100).toFixed(1)}%`;
  });
  await expect(results.locator('tbody .optimizer-damage small')).toHaveText(percentage);
  // Keep the equipped DPS difference directly below the percentage instead of consuming a column.
  await expect(results.getByRole('columnheader', { name: 'Δ equipped', exact: true })).toHaveCount(0);
  const comparison = results.locator('tbody .optimizer-comparison');
  const difference = await page.evaluate(() => {
    const state = window.professionApp.gearOptimizerRunner.state;
    const delta = state.winners[0].score.dps - state.baseline.dps;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} DPS`;
  });
  await expect(comparison.locator('.optimizer-delta')).toHaveText(difference);
  const percentBounds = await comparison.locator('small').boundingBox();
  const deltaBounds = await comparison.locator('.optimizer-delta').boundingBox();
  expect(deltaBounds.y).toBeGreaterThanOrEqual(percentBounds.y + percentBounds.height);
  expect(deltaBounds.x).toBe(percentBounds.x);
  // Both candidate and equipped comparisons sit below their DPS, sharing its left edge.
  for (const damage of await results.locator('td.optimizer-damage').all()) {
    const score = await damage.locator('.optimizer-score').boundingBox();
    const comparison = await damage.locator('.optimizer-comparison').boundingBox();
    expect(comparison.y).toBeGreaterThanOrEqual(score.y + score.height);
    expect(comparison.x).toBe(score.x);
  }

  await expect(results.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  await expect(results.getByRole('columnheader', { name: 'Helm', exact: true })).toBeVisible();
  // Set headers span the actual weapon slots and sigil pairs without repeating labels in each column.
  await expect(results.locator('thead tr:first-child th[scope="colgroup"]')).toHaveText([
    'Weapon set 1',
    'Weapon set 2'
  ]);
  expect(
    await results
      .locator('thead tr:first-child th[scope="colgroup"]')
      .evaluateAll((headers) => headers.map((header) => header.colSpan))
  ).toEqual([4, 3]);
  await expect(results.locator('thead tr').nth(1).locator('th')).toHaveText([
    'Dagger (MH)',
    'Sword (OH)',
    'Sigils',
    'Spear (2H)',
    'Sigils'
  ]);
  // Two-line weapon names stay inside the same header row as the other column labels.
  const labelPositions = await results
    .locator('th[scope="col"]')
    .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().bottom));
  expect(Math.max(...labelPositions) - Math.min(...labelPositions)).toBeLessThan(1);

  await expect(results.locator('tbody').getByRole('cell', { name: /^Set 2 sigil 1:/ })).toBeVisible();
  // Row selection inspects an isolated candidate; changing preview sets must never save or equip it.
  const equippedBuild = await page.evaluate(() => JSON.stringify(window.professionApp.build));
  await results.locator('tbody tr').first().getByRole('cell', { name: 'Food: None', exact: true }).click();
  const preview = panel.locator('[data-role="optimizer-preview"]');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Result character', exact: true })).toBeVisible();
  await expect(results.locator('tbody tr').first()).toHaveClass(/optimizer-selected/);
  await expect(results.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(results.locator('tbody tr').first().getByText('Previewing', { exact: true })).toBeVisible();
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
  await expect(preview.locator('.optimizer-preview-portrait strong')).toHaveCount(0);
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await expect(preview.locator('.attr-row').filter({ hasText: /^Power/ })).toBeVisible();
  // Accept source and bundled artwork so this worker regression also runs against production builds in WebKit.
  await expect(preview.locator('.optimizer-preview-portrait img')).toHaveAttribute(
    'src',
    /\/(?:images\/professions\/virtuoso|assets\/virtuoso-[\w-]+)\.png$/
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
  expect(portraitBounds.height).toBeGreaterThan(600);
  const trinketRows = await preview
    .locator('.optimizer-preview-trinkets .optimizer-preview-item')
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(new Set(trinketRows).size).toBe(1);
  await preview.screenshot({ path: '.scratch/optimizer/character-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await preview.screenshot({ path: '.scratch/optimizer/character-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await preview.getByRole('combobox', { name: 'Preview weapon set', exact: true }).selectOption('2');
  expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(equippedBuild);
  await results.getByRole('row', { name: 'Equipped setup', exact: true }).focus();
  await page.keyboard.press('Enter');
  // Selecting the best/equipped row uses the same preview highlight, overriding its ranking color.
  await expect(results.locator('tbody .optimizer-selected')).toHaveCount(0);
  await expect(results.locator('tfoot .optimizer-selected')).toHaveAttribute('aria-current', 'true');
  await expect(results.locator('.optimizer-preview-marker:visible')).toHaveCount(1);
  expect(
    await results
      .locator('tfoot .optimizer-selected td')
      .first()
      .evaluate((cell) => getComputedStyle(cell).backgroundColor)
  ).toBe(selectedBackground);
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText(currentFood);
  await results.locator('tbody tr').first().focus();
  await page.keyboard.press('Space');
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await panel.getByRole('button', { name: 'Apply result 1', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const after = await page.evaluate(() => ({
    revision: window.professionApp.buildRevision,
    rotation: window.professionApp.build.rotation,
    weapons: window.professionApp.build.weapons,
    food: window.professionApp.build.food
  }));
  expect(after).toEqual({ ...before, revision: before.revision + 1, food: '' });
  await expect(panel.locator('[data-apply]')).toHaveCount(0);
  await expect(
    panel
      .getByRole('row', { name: 'Equipped setup', exact: true })
      .getByRole('cell', { name: 'Food: None', exact: true })
  ).toBeVisible();
});

test('large search remains responsive and navigation cancels its workers', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.getByRole('spinbutton', { name: 'Workers', exact: true }).fill('4');
  await addChoice(panel, 'prefixes', "Assassin's");
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Evaluating', { timeout: 20000 });
  await expect(panel.getByRole('spinbutton', { name: 'Workers', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.professionApp.gearOptimizerRunner.batch.workers.size)).toBe(4);
  await expect(panel.locator('[data-role="optimizer-counts"]')).toHaveText(/^[\d,]+ candidates checked\.$/);
  const inlineProgress = await panel.locator('.optimizer-status-text').evaluate((element) => {
    const status = element.querySelector('[data-role="optimizer-status"]').getBoundingClientRect();
    const counts = element.querySelector('[data-role="optimizer-counts"]').getBoundingClientRect();
    return counts.left >= status.right && Math.abs(counts.bottom - status.bottom) < 2;
  });
  expect(inlineProgress).toBe(true);
  await page.locator('.simulator-view-tab[data-simulator-view="workspace"]').click();
  expect(
    await page.evaluate(() => ({
      running: window.professionApp.gearOptimizerRunner.isRunning,
      status: window.professionApp.gearOptimizerRunner.state.status
    }))
  ).toEqual({ running: false, status: 'canceled' });
  await expect(panel).not.toBeVisible();
});

test('prepopulated choices enforce limits and stay usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  // Alternate font metrics catch navigation overflow that the Windows default font can hide.
  for (const font of ['inherit', 'Arial', 'Verdana']) {
    await page.locator('.simulator-view-tabs').evaluate((element, font) => (element.style.fontFamily = font), font);
    const tabs = await page.locator('.simulator-view-tab').evaluateAll((elements) =>
      elements.map((element) => {
        const { top, right } = element.getBoundingClientRect();
        return { top, right, fits: element.scrollWidth <= element.clientWidth };
      })
    );
    expect(new Set(tabs.map(({ top }) => top)).size, font).toBe(1);
    expect(
      tabs.every(({ right, fits }) => right <= 390 && fits),
      `${font}: ${JSON.stringify(tabs)}`
    ).toBe(true);
  }

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
  await expect(panel.locator('[data-role="optimizer-estimate"]')).toBeEmpty();
  await panel.screenshot({ path: '.scratch/optimizer/revised-mobile.png' });
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('bounded preparation can be canceled before scoring begins', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  // Submit and cancel in the same task so the assertion does not depend on machine preparation speed.
  await panel.evaluate((element) => {
    element.querySelector('form').requestSubmit();
    element.querySelector('[data-role="optimizer-cancel"]').click();
  });
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Canceled');
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.isRunning)).toBe(false);
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeEnabled();
});

// Compare actual candidates in the visible grid, including changes and horizontal scrolling on mobile.
test('results expose every equipment choice without expanding rows', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    window.professionApp.build.infusions = [{ stat: 'Condition Damage', count: 18 }];
  });
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
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

  await expect(panel.locator('.optimizer-exclusions, .optimizer-badge, .optimizer-intro')).toHaveCount(0);
  for (const key of ['food', 'utility']) {
    await expect(panel.locator(`input[name="${key}"]`)).toHaveValue(equipped[key]);
    await addChoice(panel, key, '');
  }

  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Complete', { timeout: 20000 });
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.locator('tbody tr')).toHaveCount(3);
  await expect(results.locator('details')).toHaveCount(0);
  await expect(results.locator('.optimizer-changed')).toHaveCount(0);
  await expect(results.getByRole('cell', { name: 'Infusions: 18 Malign', exact: true }).first()).toBeVisible();
  await expect(panel.locator('.optimizer-results-heading')).toHaveCount(0);
  await expect(results.getByRole('cell', { name: 'Food: None', exact: true }).first()).toBeVisible();
  for (const key of ['food', 'utility', 'rune']) {
    const icon = results
      .getByRole('cell', { name: `${key[0].toUpperCase() + key.slice(1)}: ${equipped[key]}`, exact: true })
      .first()
      .locator('img');
    await expect(icon).toHaveAttribute('alt', equipped[key]);
    await expect(icon).toHaveAttribute('src', /^https:\/\/render\.guildwars2\.com\/file\//);
    await expect.poll(() => icon.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }

  await expect(panel.locator('[data-role="optimizer-counts"]')).not.toContainText('raw assignments');
  await panel
    .locator('[data-role="optimizer-results"]')
    .evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 120));
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  await panel.locator('[data-role="optimizer-results"]').screenshot({ path: '.scratch/optimizer/results-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel
    .locator('[data-role="optimizer-results"]')
    .evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 120));
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)
  ).toBe(true);
  // Scores and Apply remain visible at both ends of the mobile equipment scroll.
  for (const end of [false, true]) {
    await panel.locator('.optimizer-table-scroll').evaluate((element, end) => {
      element.scrollLeft = end ? element.scrollWidth : 0;
    }, end);
    await expect(results.locator('tbody .optimizer-score').first()).toBeInViewport();
    await expect(results.getByRole('button', { name: 'Apply result 1', exact: true })).toBeInViewport();
  }
});

// Large searches skip the exhaustive index and finish with explicitly approximate, verified results.
test('large searches use a bounded candidate budget and leave the page usable', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', {
    timeout: 60000
  });
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.isRunning)).toBe(false);
  const simulations = await page.evaluate(() => Number(window.professionApp.gearOptimizerRunner.state.simulations));
  expect(simulations).toBeGreaterThan(256);
  expect(simulations).toBeLessThanOrEqual(2048);
  await expect(panel.getByRole('button', { name: 'Apply result 1', exact: true })).toBeEnabled();
});

test('result filters group upgrades without rerunning and keep equipped gear pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const equipped = await page.evaluate(() => ({
    food: window.professionApp.build.food,
    rune: window.professionApp.build.rune,
    sigils: window.professionApp.build.weaponSigils[0]
  }));
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await addChoice(panel, 'food', '');
  await addChoice(panel, 'utility', '');
  await addChoice(panel, 'rune sets', equipped.rune === 'Scholar' ? 'Dragonhunter' : 'Scholar');
  await addChoice(
    panel,
    'set 1 sigil 1',
    ['Force', 'Accuracy', 'Impact', 'Air'].find((sigil) => !equipped.sigils.includes(sigil))
  );
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  const before = await page.evaluate(() => ({
    simulations: String(window.professionApp.gearOptimizerRunner.state.simulations),
    revision: window.professionApp.buildRevision
  }));
  const pinned = panel.getByRole('row', { name: 'Equipped setup', exact: true });
  await expect(panel.locator('tbody .optimizer-best').getByText('Best', { exact: true })).toBeVisible();
  await expect(pinned.getByText('Best', { exact: true })).toHaveCount(0);
  await expect(pinned.getByRole('cell', { name: `Food: ${equipped.food}`, exact: true })).toBeVisible();
  await expect(pinned.getByRole('button')).toHaveCount(0);
  await panel.locator('.optimizer-filter-settings > summary').click();
  for (const [label, count] of [
    ['All combinations', 15],
    ['Sigils', 2],
    ['Runes', 2],
    ['Relics', 1],
    ['Food', 2],
    ['Utility', 2],
    ['No filtering', 15]
  ]) {
    await panel.getByRole('radio', { name: label, exact: true }).check();
    await expect(panel.locator('tbody tr')).toHaveCount(count);
    await expect(pinned).toBeVisible();
    // Even a single result must leave the bottom of the filter menu visible and clickable.
    const menuNote = panel.locator('.optimizer-filter-settings fieldset p');
    await panel.locator('.optimizer-filter-settings').evaluate((element) => {
      window.scrollBy(0, element.getBoundingClientRect().top - 100);
    });
    expect(
      await menuNote.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      })
    ).toBe(true);
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
      revision: window.professionApp.buildRevision
    }))
  ).toEqual(before);
  await panel.screenshot({ path: '.scratch/optimizer/filter-settings.png' });
  await panel.getByRole('radio', { name: 'No filtering', exact: true }).press('Escape');
  const scroll = panel.locator('.optimizer-table-scroll');
  await panel.locator('.optimizer-filter-settings > summary').click();
  await panel.locator('[data-role="optimizer-status"]').click();
  await expect(panel.locator('.optimizer-filter-settings')).not.toHaveAttribute('open');
  for (const bottom of [false, true]) {
    await scroll.evaluate((element, bottom) => {
      element.scrollTop = bottom ? element.scrollHeight : 0;
    }, bottom);
    const bounds = await scroll.boundingBox();
    const row = await pinned.locator('td').first().boundingBox();
    expect(row.y).toBeGreaterThanOrEqual(bounds.y);
    expect(row.y + row.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    const viewportBottom = await scroll.evaluate(
      (element) => element.getBoundingClientRect().top + element.clientTop + element.clientHeight
    );
    // clientHeight rounds to whole pixels while bounding boxes preserve fractional layout coordinates.
    expect(Math.abs(row.y + row.height - viewportBottom)).toBeLessThan(0.5);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await panel.locator('.optimizer-filter-settings > summary').click();
  await panel.getByRole('radio', { name: 'Food', exact: true }).check();
  const menu = await panel.locator('.optimizer-filter-settings fieldset').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(390);
  await panel.getByRole('radio', { name: 'Food', exact: true }).press('Escape');
  const withoutFood = panel
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: 'Food: None', exact: true }) });
  await withoutFood.getByRole('button', { name: /^Apply result/ }).click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.food)).toBe('');
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(before.revision + 1);
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.');
  await expect(pinned.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  const nextResult = panel
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: `Food: ${equipped.food}`, exact: true }) });
  await nextResult.getByRole('button', { name: /^Apply result/ }).click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.food)).toBe(equipped.food);
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(before.revision + 2);
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
  for (const button of await panel.locator('[data-apply]').all()) await expect(button).toBeDisabled();
});

// Exercise both axes independently through scoring, preview, and Apply on a Hammer / Axe-Axe Soulbeast.
test('Soulbeast optimizes and applies the off-hand axe independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/ranger.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.startingWeaponSet = 2;
    app.addRotation('Whirling Defense');
  });
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const panel = page.locator('#gear-optimizer');
  await panel.locator('.optimizer-forced-slots > summary').click();
  await panel.locator('[data-forced-slot="AlternateWeapon2"]').selectOption("Viper's");
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.locator('thead tr:first-child th[scope="colgroup"]')).toHaveText([
    'Weapon set 1',
    'Weapon set 2'
  ]);
  await expect(results.locator('thead tr').nth(1).locator('th')).toHaveText([
    'Hammer (2H)',
    'Sigils',
    'Axe (MH)',
    'Axe (OH)',
    'Sigils'
  ]);
  const row = results.locator('tbody tr').first();
  await expect(row.getByRole('cell', { name: "Weapon1: Berserker's", exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: "AlternateWeapon1: Berserker's", exact: true })).toBeVisible();
  const offhand = row.getByRole('cell', { name: "AlternateWeapon2: Viper's", exact: true });
  await expect(offhand).toBeVisible();
  expect(
    await page.evaluate(() => {
      const state = window.professionApp.gearOptimizerRunner.state;
      return state.winners[0].score.dps !== state.baseline.dps;
    })
  ).toBe(true);
  await offhand.click();
  await expect(
    panel.locator('.optimizer-preview-weapons').getByRole('group', { name: /^Axe: Berserker's;/ })
  ).toBeVisible();
  await expect(
    panel.locator('.optimizer-preview-weapons').getByRole('group', { name: /^Axe: Viper's;/ })
  ).toBeVisible();
  await panel
    .locator('[data-role="optimizer-results"]')
    .screenshot({ path: '.scratch/optimizer/soulbeast-weapons.png' });
  await row.getByRole('button', { name: 'Apply result 1', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(
    await page.evaluate(() => {
      const build = window.professionApp.build;
      return [build.weapons, build.alternateWeapons, build.gear.Weapon1, build.alternateWeaponPrefixes];
    })
  ).toEqual([['Hammer', ''], ['Axe', 'Axe'], "Berserker's", ["Berserker's", "Viper's"]]);
});

test('an unchanged setup appears only in the pinned row', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await expect(panel.locator('tbody tr')).toHaveCount(0);
  await expect(panel.getByRole('row', { name: 'Equipped setup', exact: true })).toBeVisible();
  await expect(panel.locator('[data-apply]')).toHaveCount(0);
});
