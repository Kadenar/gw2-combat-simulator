import { expect, test } from '@playwright/test';

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
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
  await expect(panel).toBeVisible();
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
  await expect(panel.locator('[data-role="optimizer-counts"]')).toContainText('1 / 1 candidates checked');
  await expect(panel.locator('tbody tr')).toHaveCount(1);
  const results = panel.getByRole('table', { name: 'Gear comparison' });
  await expect(results.locator('details')).toHaveCount(0);
  await expect(results.getByRole('cell', { name: 'Food: None', exact: true })).toBeVisible();
  await expect(results.getByRole('columnheader', { name: 'Helm', exact: true })).toBeVisible();
  await expect(results.getByRole('cell', { name: /^Set 2 sigil 1:/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Apply result 1', exact: true }).click();
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  const after = await page.evaluate(() => ({
    revision: window.professionApp.buildRevision,
    rotation: window.professionApp.build.rotation,
    weapons: window.professionApp.build.weapons,
    food: window.professionApp.build.food
  }));
  expect(after).toEqual({ ...before, revision: before.revision + 1, food: '' });
  await expect(panel.getByRole('button', { name: 'Apply result 1', exact: true })).toBeDisabled();
});

test('large search remains responsive and navigation cancels its workers', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
  await panel.getByRole('spinbutton', { name: 'Workers', exact: true }).fill('4');
  await addChoice(panel, 'prefixes', "Assassin's");
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('Evaluating', { timeout: 20000 });
  await expect(panel.getByRole('spinbutton', { name: 'Workers', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.professionApp.gearOptimizerRunner.batch.workers.size)).toBe(4);
  await expect(panel.locator('[data-role="optimizer-counts"]')).toHaveText(
    /^[\d,]+ \/ [\d,]+ candidates checked; [\d,]+ simulations\.$/
  );
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
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
  const prefixes = panel.getByRole('combobox', { name: 'Add prefixes', exact: true });
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  await expect(prefixes).toBeDisabled();
  await panel.getByRole('button', { name: "Remove Viper's from prefixes", exact: true }).click();
  await expect(prefixes).toBeEnabled();
  await panel.screenshot({ path: '.scratch/optimizer/revised-mobile.png' });
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('unique-stat preparation can be canceled before scoring begins', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
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
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
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
  await expect(results.locator('tbody tr')).toHaveCount(4);
  await expect(results.locator('details')).toHaveCount(0);
  await expect(results.locator('.optimizer-changed').first()).toBeVisible();
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

// Oversized exact preparation must report failure without exhausting the page or enabling partial Apply.
test('oversized stat preparation fails safely and leaves the page usable', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: 'Analysis', exact: true }).click();
  const panel = page.locator('#gear-optimizer');
  await panel.locator(':scope > summary').click();
  for (const prefix of ["Assassin's", "Viper's"]) await addChoice(panel, 'prefixes', prefix);
  await panel.getByRole('button', { name: 'Run optimizer', exact: true }).click();
  await expect(panel.locator('[data-role="optimizer-status"]')).toContainText('preparation memory limit', {
    timeout: 20000
  });
  await expect(panel.getByRole('button', { name: 'Run optimizer', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.professionApp.gearOptimizerRunner.isRunning)).toBe(false);
  await expect(panel.locator('[data-apply]')).toHaveCount(0);
});
