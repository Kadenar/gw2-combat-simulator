import { expect, test } from '@playwright/test';

// Search changes only the available choices; adding/removing still owns the submitted equipment values and caps.
test('candidate search matches unordered word fragments and stats without submitting', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const panel = page.locator('#gear-optimizer');
  const picker = panel.locator('[data-picker="food"]');
  const search = picker.getByRole('searchbox', { name: 'Search food' });
  const select = picker.locator('select');
  const trigger = picker.getByRole('button', { name: 'Add food', exact: true });
  const name = 'Bowl of Curry Butternut Squash Soup';
  const target = select.locator(`option[data-choice="${name}"]`);
  await picker.getByRole('button', { name: /^Remove / }).click();
  await expect(search).toBeHidden();
  await trigger.click();
  await expect(search).toBeFocused();
  await expect(picker.locator('.gear-select-menu:popover-open').getByRole('searchbox')).toBeVisible();
  await panel.locator('form').evaluate((form) => {
    form.dataset.changes = '0';
    form.dataset.submits = '0';
    form.addEventListener('change', () => {
      form.dataset.changes = String(Number(form.dataset.changes) + 1);
    });
    form.addEventListener('submit', () => {
      form.dataset.submits = String(Number(form.dataset.submits) + 1);
    });
  });
  for (const query of ['SOUP curry', 'squash butter', 'precision curry', '  curry, SOUP!  ']) {
    await search.fill(query);
    await expect(picker.getByRole('option').filter({ hasText: name })).toBeVisible();
    await expect(picker.getByRole('option', { name: 'None', exact: true })).toHaveCount(0);
  }

  await search.fill('zzzzzzzz');
  await expect(picker.getByRole('status')).toHaveText('No matching choices');
  await expect(picker.getByRole('option')).toHaveCount(0);
  await search.press('Enter');
  await expect(picker.locator('input[type="hidden"]')).toHaveCount(0);
  await search.dispatchEvent('change');
  await expect(panel.locator('form')).toHaveAttribute('data-changes', '0');
  await expect(panel.locator('form')).toHaveAttribute('data-submits', '0');
  await search.press('Escape');
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(search).toHaveValue('');
  await expect(target).not.toHaveAttribute('hidden');
  await search.fill('squash curry');
  await search.press('Enter');
  await expect(picker.locator('input[name="food"]')).toHaveValue(name);
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(target).toBeDisabled();
  for (const query of ['none', 'fire chili']) {
    await trigger.click();
    await search.fill(query);
    await search.press('Enter');
  }

  await expect(trigger).toBeDisabled();
  await expect(select).toBeDisabled();
  await picker.getByRole('button', { name: 'Remove None from food', exact: true }).click();
  await expect(trigger).toBeEnabled();
  await expect(select).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await trigger.click();
  await search.fill('');
  await picker.locator('.dropdown-search-results').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await picker.locator('.dropdown-search-results').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const inputBounds = await search.boundingBox();
  const resultsBounds = await picker.locator('.dropdown-search-results').boundingBox();
  expect(resultsBounds.y).toBeGreaterThanOrEqual(inputBounds.y + inputBounds.height);
  expect(await picker.locator('.gear-select-menu').evaluate((element) => element.scrollTop)).toBe(0);
  const menu = await picker.locator('.gear-select-menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.scratch/optimizer/searchable-dropdown.png' });
});

// A matching equipped sigil remains visible but cannot be selected again in the other socket.
test('disabled matching sigils do not show a false empty search message', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#sel-sig1-1').selectOption('Force', { force: true });
  await page.locator('#sel-sig1-2').selectOption('Slaying', { force: true });
  const picker = page.locator('#sel-sig1-1').locator('..');
  await picker.locator('.gear-select-trigger').click();
  const search = picker.getByRole('searchbox');
  await search.fill('sla');
  const slaying = picker.getByRole('option', { name: /^Slaying / });
  await expect(slaying).toBeVisible();
  await expect(slaying).toBeDisabled();
  await expect(picker.getByRole('status')).toBeHidden();
  await search.press('Enter');
  await expect(page.locator('#sel-sig1-1')).toHaveValue('Force');
  await search.fill('zzzzzz');
  await expect(slaying).toBeHidden();
  await expect(picker.getByRole('status')).toBeVisible();
});

// Short fragments match real text in both optimizer and equipped gear, never a subsequence such as b-l-i in bleeding.
test('gear and optimizer search reject skipped letters and apply the chosen item', async ({ page }) => {
  await page.goto('/mesmer.html#gear-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const picker = page.locator('#gear-optimizer [data-picker="sigil1-1"]');
  await picker.getByRole('button', { name: 'Add set 1 sigil 1', exact: true }).click();
  await picker.getByRole('searchbox').fill('bli');
  await expect(picker.getByRole('option').filter({ hasText: 'Blight' })).toBeVisible();
  for (const name of ['Agony', 'Earth', 'Geomancy']) {
    await expect(picker.getByRole('option').filter({ hasText: name })).toHaveCount(0);
  }

  await picker.getByRole('searchbox').press('Escape');
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Food', exact: true });
  await trigger.focus();
  await trigger.press('c');
  const menu = page.locator('.gear-select-menu:popover-open');
  const search = menu.getByRole('searchbox', { name: 'Search Food', exact: true });
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('c');
  await search.fill('soup curry');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  expect(await page.evaluate(() => window.professionApp.build.food)).toBe('Bowl of Curry Butternut Squash Soup');
});

// Standard skills and profession-specific selectors use the same input, filtering, and keyboard selection.
test('skill choices support word search and keyboard selection', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const trigger = page.getByRole('button', { name: 'Change utility 1 skill', exact: true });
  await trigger.click();
  const menu = page.locator('.sbar-dropdown.open');
  const search = menu.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('disen phant');
  await expect(menu.locator('.dd-item:visible')).toHaveCount(1);
  await search.press('ArrowDown');
  await expect(menu.getByRole('button', { name: 'Phantasmal Disenchanter', exact: true })).toBeFocused();
  await menu.locator('.dd-item:visible').press('Enter');
  expect(await page.evaluate(() => window.professionApp.build.selectedSkills.Utility1)).toBe('Phantasmal Disenchanter');
});

test('pet and legend menus use the shared word search', async ({ page }) => {
  await page.goto('/ranger.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const pet = page.locator('[data-selection-key="selectedPet"]');
  await pet.locator('.sbar-icon').click();
  await pet.getByRole('searchbox').fill('tiger white');
  await expect(pet.locator('.dd-item:visible')).toHaveCount(1);
  await pet.getByRole('searchbox').press('Enter');
  expect(await page.evaluate(() => window.professionApp.build.selectedPet)).toBe('White Tiger');
  await page.goto('/revenant.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.fixed-loadout-trigger').first().click();
  const menu = page.locator('.fixed-loadout-dropdown.open');
  await menu.getByRole('searchbox').fill('zzzzzzz');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(menu.getByRole('status')).toHaveText('No matching choices');
  await menu.getByRole('searchbox').press('Escape');
  await expect(page.locator('.fixed-loadout-trigger').first()).toBeFocused();
});

// The gear editor's decorated version must hide the same matches and keep keyboard selection working.
test('precast relic search filters its popover', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const picker = page.locator('#precast-relics');
  const search = picker.getByRole('searchbox', { name: 'Search precast relics' });
  const add = picker.getByRole('button', { name: 'Add precast relics', exact: true });
  await expect(add).toHaveCSS('width', '36px');
  await expect(add).toHaveCSS('height', '36px');
  await expect(add).toHaveCSS('padding', '0px');
  await expect(search).toBeHidden();
  await picker.getByRole('button', { name: 'Add precast relics', exact: true }).click();
  await expect(search).toBeFocused();
  await search.fill('balr mount');
  await search.press('ArrowDown');
  const menu = picker.getByRole('listbox');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await expect(menu.getByRole('option')).toContainText('Mount Balrior');
  await expect(menu.getByRole('option')).toBeFocused();
  await menu.getByRole('option').press('Enter');
  await expect(picker.locator('input[name="precastRelics"]')).toHaveValue('Mount Balrior');
  await expect(search).toBeHidden();
  await picker.getByRole('button', { name: 'Add precast relics', exact: true }).click();
  await expect(search).toHaveValue('');
});
