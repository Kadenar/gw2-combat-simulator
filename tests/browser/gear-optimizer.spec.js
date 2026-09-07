import { expect, test } from '@playwright/test';

// The dedicated route owns both tools and can run a relic graph without ever mounting Analysis.
test('gear optimizer tab owns relic comparison and restores through browser history', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const tab = page.getByRole('link', { name: 'Gear Optimizer', exact: true });
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#gear-optimizer form')).toBeVisible();
  await expect(page.locator('#gear-optimizer-view > .optimizer-view-heading, #gear-optimizer > summary')).toHaveCount(
    0
  );
  await expect(page.locator('#rotation-results')).toBeHidden();
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
});

// Optional requirements survive worker updates, reject before combat, and disappear when cleared.
test('optimizer requirement inputs reject candidates and blank fields remove limits', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  for (const label of [
    'Minimum toughness',
    'Maximum toughness',
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
  await expect(panel.getByRole('table', { name: 'Gear comparison' })).toBeVisible();
});

/** Pick by the underlying equipment identity while the dropdown supplies readable attribute descriptions. */
async function addChoice(panel, label, choice) {
  const select = panel.getByRole('combobox', { name: `Add ${label}`, exact: true });
  const value = await select
    .locator('option')
    .evaluateAll((options, choice) => options.find((option) => option.dataset.choice === choice).value, choice);
  await select.selectOption(value);
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
  await expect(panel.locator('input[type="checkbox"]')).toHaveCount(0);
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
  await expect(results.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  await expect(results.getByRole('columnheader', { name: 'Helm', exact: true })).toBeVisible();
  for (const set of [1, 2]) {
    for (const label of ['Main hand', 'Sigil 1', 'Sigil 2'])
      await expect(
        results.getByRole('columnheader', { name: `${label} Weapon set ${set}`, exact: true })
      ).toBeVisible();
  }

  await expect(results.locator('tbody').getByRole('cell', { name: /^Set 2 sigil 1:/ })).toBeVisible();
  // Row selection inspects an isolated candidate; changing preview sets must never save or equip it.
  const equippedBuild = await page.evaluate(() => JSON.stringify(window.professionApp.build));
  await results.locator('tbody tr').first().getByRole('cell', { name: 'Food: None', exact: true }).click();
  const preview = panel.getByRole('region', { name: 'Result character', exact: true });
  await expect(preview).toBeVisible();
  await expect(results.locator('tbody tr').first()).toHaveClass(/optimizer-selected/);
  await expect(results.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(results.locator('tbody tr').first().getByText('Previewing', { exact: true })).toBeVisible();
  const selectedBackground = await results
    .locator('tbody .optimizer-selected td')
    .first()
    .evaluate((cell) => getComputedStyle(cell).backgroundColor);
  // Equipment icons replace slot labels, while upgrades stay attached to their actual armor or weapon.
  const armor = preview.getByRole('region', { name: 'Armor', exact: true });
  await expect(armor.locator('.optimizer-preview-item-icon')).toHaveCount(6);
  await expect(armor.getByRole('group', { name: /^Helm:/ }).locator('.optimizer-preview-item-icon')).toHaveAttribute(
    'src',
    'https://render.guildwars2.com/file/AD7849A39265D6AA1C712ACD476E912E1EC30839/699210.png'
  );
  await expect(armor.getByText('Helm', { exact: true })).toHaveCount(0);
  const secondSet = preview.getByRole('group', { name: 'Weapon set 2', exact: true });
  await expect(secondSet.locator('.optimizer-preview-item-icon')).toHaveCount(1);
  await expect(secondSet.locator('.optimizer-preview-upgrade')).toHaveCount(2);
  await expect(preview.getByText('Weapon set 2', { exact: true })).toHaveCount(0);
  await expect(preview.locator('.optimizer-preview-portrait strong')).toHaveCount(0);
  await expect(preview.getByRole('group', { name: /^Food:/ })).toContainText('None');
  await expect(preview.locator('.attr-row').filter({ hasText: /^Power/ })).toBeVisible();
  await expect(preview.locator('.optimizer-preview-portrait img')).toHaveAttribute(
    'src',
    /\/images\/professions\/virtuoso\.png$/
  );
  await expect
    .poll(() => preview.locator('.optimizer-preview-portrait img').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
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
  // All navigation tabs fit one row even with the optimizer's longer label.
  const tabs = await page.locator('.simulator-view-tab').evaluateAll((elements) =>
    elements.map((element) => {
      const { top, right } = element.getBoundingClientRect();
      return { top, right, fits: element.scrollWidth <= element.clientWidth };
    })
  );
  expect(new Set(tabs.map(({ top }) => top)).size).toBe(1);
  expect(tabs.every(({ right, fits }) => right <= 390 && fits)).toBe(true);
  const panel = page.locator('#gear-optimizer');
  const prefixes = panel.getByRole('combobox', { name: 'Add prefixes', exact: true });
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  await expect(prefixes).toBeDisabled();
  await panel.getByRole('button', { name: "Remove Viper's from prefixes", exact: true }).click();
  await expect(prefixes).toBeEnabled();
  await addChoice(panel, 'infusion stats', 'Condition Damage');
  const infusionSelect = await panel.getByRole('combobox', { name: 'Add infusion stats', exact: true }).boundingBox();
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
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
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
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await panel.locator('[data-role="optimizer-results"]').screenshot({ path: '.scratch/optimizer/results-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(
    await panel.locator('.optimizer-table-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)
  ).toBe(true);
  await results.getByRole('button', { name: 'Apply result 1', exact: true }).scrollIntoViewIfNeeded();
  await expect(results.getByRole('button', { name: 'Apply result 1', exact: true })).toBeInViewport();
});

// Large searches skip the exhaustive index and finish with explicitly approximate, verified results.
test('large searches use a bounded candidate budget and leave the page usable', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
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
    expect(Math.abs(row.y + row.height - viewportBottom)).toBeLessThan(0.1);
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

test('an unchanged setup appears only in the pinned row', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Gear Optimizer', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toHaveText('Complete.', { timeout: 20000 });
  await expect(panel.locator('tbody tr')).toHaveCount(0);
  await expect(panel.getByRole('row', { name: 'Equipped setup', exact: true })).toBeVisible();
  await expect(panel.locator('[data-apply]')).toHaveCount(0);
});
