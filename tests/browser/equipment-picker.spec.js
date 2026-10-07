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
  // One UI query checks filtering; the pure matcher owns the word and punctuation matrix.
  await search.fill('soup curry');
  await expect(picker.getByRole('option').filter({ hasText: name })).toBeVisible();
  await expect(picker.getByRole('option', { name: 'None', exact: true })).toHaveCount(0);

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

// Standard skills and profession-specific selectors use the same input, filtering, and keyboard selection.
test('skill choices support word search and keyboard selection', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const trigger = page.getByRole('button', { name: 'Change utility 1 skill', exact: true });
  await trigger.click();
  const menu = page.locator('.sbar-dropdown.open');
  const search = menu.getByRole('searchbox');
  await expect(search).toBeFocused();
  // Skill results own the constrained menu's scroll while the search field stays fixed above them.
  const results = menu.locator('.dropdown-search-results');
  expect(await results.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await results.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await menu.evaluate((element) => element.scrollTop)).toBe(0);
  await search.fill('disen phant');
  await expect(menu.locator('.dd-item:visible')).toHaveCount(1);
  await search.press('ArrowDown');
  await expect(menu.getByRole('button', { name: 'Phantasmal Disenchanter', exact: true })).toBeFocused();
  await menu.locator('.dd-item:visible').press('Enter');
  expect(await page.evaluate(() => window.professionApp.build.selectedSkillIds.Utility1)).toBe(10267);
  await expect(trigger).toBeFocused();
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
  // Committing replaces the menu, so keyboard navigation must resume at the new trigger.
  await expect(pet.locator('.sbar-icon')).toBeFocused();
  await page.keyboard.press('Tab');
  // Skill triggers tab through their wiki link before continuing to the next selector.
  await expect(page.locator('#wiki-tooltip').getByRole('link')).toBeFocused();
  await page.keyboard.press('Tab');
  const secondPet = page.locator('[data-selection-key="selectedPet2"]');
  await expect(secondPet.locator('.sbar-icon')).toBeFocused();
  // Space activates a focused native option; pointer selection uses the same commit handler.
  await page.keyboard.press('Enter');
  await secondPet.getByRole('searchbox').fill('hawk');
  await page.keyboard.press('ArrowDown');
  await expect(secondPet.getByRole('button', { name: 'Hawk', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.professionApp.build.selectedPet2)).toBe('Hawk');
  await expect(secondPet.locator('.sbar-icon')).toBeFocused();
  await secondPet.locator('.sbar-icon').click();
  await secondPet.getByRole('button', { name: 'Tiger', exact: true }).click();
  expect(await page.evaluate(() => window.professionApp.build.selectedPet2)).toBe('Tiger');
  await expect(secondPet.locator('.sbar-icon')).toBeFocused();
  await page.goto('/revenant.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.fixed-loadout-trigger').first().click();
  const menu = page.locator('.fixed-loadout-dropdown.open');
  await menu.getByRole('searchbox').fill('zzzzzzz');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(menu.getByRole('status')).toHaveText('No matching choices');
  await menu.getByRole('searchbox').press('Escape');
  await expect(page.locator('.fixed-loadout-trigger').first()).toBeFocused();
  // Each legend slot must restore its own trigger after a successful choice.
  for (const index of [0, 1]) {
    const trigger = page.locator('.fixed-loadout-trigger').nth(index);
    await trigger.press('Enter');
    const option = menu.locator('.fixed-loadout-option:not(:disabled):not(.selected)').first();
    const value = await option.getAttribute('data-loadout-value');
    await menu.getByRole('searchbox').fill((await option.textContent()).trim());
    if (index === 1) {
      await page.keyboard.press('ArrowDown');
      await expect(option).toBeFocused();
    }

    await page.keyboard.press('Enter');
    expect(await page.evaluate((slot) => window.professionApp.build.selectedLegends[slot], index)).toBe(value);
    await expect(trigger).toBeFocused();
    if (index === 0) {
      await page.keyboard.press('Tab');
      await expect(page.locator('#wiki-tooltip').getByRole('link')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('.fixed-loadout-trigger').nth(1)).toBeFocused();
    }
  }
});

// Array-backed selectors restore the edited index, even when other slots change along with it.
for (const [profession, key, specialization, index] of [
  ['ranger', 'selectedHammerSkillIds', 'Soulbeast', 1],
  ['engineer', 'selectedMorphSkillIds', 'Amalgam', 1]
]) {
  test(`${profession} skill selection retains focus at the edited slot`, async ({ page }) => {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await page.evaluate(
      ({ profession, specialization }) => {
        const app = window.professionApp;
        app.build.specializations[2] = { name: specialization, traits: '1-1-1' };
        if (profession === 'ranger') app.build.weapons = ['Hammer', ''];
        app.changed();
      },
      { profession, specialization }
    );
    const selector = page.locator(`[data-selection-key="${key}"][data-selection-index="${index}"]`);
    const trigger = selector.locator('.sbar-icon');
    const current = await page.evaluate(({ key, index }) => window.professionApp.build[key][index], { key, index });
    await trigger.press('Enter');
    const option = selector.locator(`.dd-item:not([data-skill-id="${current}"])`).first();
    const value = Number(await option.getAttribute('data-skill-id'));
    await selector.getByRole('searchbox').fill((await option.textContent()).trim());
    await page.keyboard.press('ArrowDown');
    await expect(option).toBeFocused();
    await page.keyboard.press(profession === 'ranger' ? 'Enter' : 'Space');
    expect(await page.evaluate(({ key, index }) => window.professionApp.build[key][index], { key, index })).toBe(value);
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#wiki-tooltip').getByRole('link')).toBeFocused();
    await page.keyboard.press('Tab');
    const next = page.locator(`[data-selection-key="${key}"][data-selection-index="${index + 1}"] .sbar-icon`);
    await expect(next).toBeFocused();
    // Worker completion must not move focus back to the control that initiated the update.
    await expect
      .poll(() => page.evaluate(() => window.professionApp.resultRevision === window.professionApp.buildRevision))
      .toBe(true);
    await expect(next).toBeFocused();

    if (profession === 'ranger') {
      // Exercise a rebuild that removes this conditional selector and establishes focus elsewhere.
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await trigger.press('Enter');
      await page.evaluate(() => {
        const app = window.professionApp;
        const changed = app.changed.bind(app);
        app.changed = () => {
          app.changed = changed;
          app.build.weapons = ['Sword', 'Axe'];
          app.build.alternateWeapons = ['', ''];
          changed();
          document.querySelector('[data-selection-key="selectedPet2"] .sbar-icon').focus();
        };
      });
      await selector.getByRole('searchbox').press('Enter');
      await expect(selector).toHaveCount(0);
      await expect(page.locator('[data-selection-key="selectedPet2"] .sbar-icon')).toBeFocused();
      expect(errors).toEqual([]);
    }
  });
}
