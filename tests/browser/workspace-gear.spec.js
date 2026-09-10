import { expect, test } from '@playwright/test';

// Exercise visible choices so the regrouped controls must still update the saved build.
async function chooseEquipment(page, selector, value) {
  const display = page.locator('.gear-select-display').filter({ has: page.locator(selector) });
  const editor = display.locator('xpath=ancestor::*[contains(@class,"weapon-editor")]');
  if ((await editor.count()) && !(await editor.isVisible())) {
    await page
      .locator(`[popovertarget="${await editor.getAttribute('id')}"]`)
      .first()
      .click();
  }

  await display.locator('.gear-select-trigger').click();
  await display
    .getByRole('option')
    .filter({ has: page.locator(`.gear-option-name`, { hasText: value }) })
    .first()
    .click();
  await expect(page.locator(selector)).toHaveValue(value);
  if ((await editor.count()) && (await editor.isVisible())) await page.keyboard.press('Escape');
}

async function chooseWeapon(page, selector, value) {
  const editor = page.locator(selector).locator('xpath=ancestor::*[contains(@class,"weapon-editor")]');
  const id = await editor.getAttribute('id');
  if (!(await editor.isVisible())) await page.locator(`[popovertarget="${id}"]`).first().click();
  await page.locator(selector).selectOption(value);
  await expect(page.locator(selector)).toHaveValue(value);
  await page.keyboard.press('Escape');
}

// Trinkets occupy the former artwork column, while every profession keeps its inherited theme.
test('workspace places trinkets beside gear and keeps import available without Revenant skills', async ({ page }) => {
  await page.setViewportSize({ width: 1640, height: 1100 });
  await page.goto('/engineer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#gear-slots .gear-item-icon img')).toHaveCount(6);
  await expect(page.locator('#trinket-slots .gear-item-icon img')).toHaveCount(6);
  await expect(
    page.locator('.workspace-traits-heading').getByRole('button', { name: 'Import GW2 Build', exact: true })
  ).toBeVisible();
  await expect(page.locator('.workspace-heading')).toHaveCount(0);
  const traits = await page.locator('.workspace-traits').boundingBox();
  const gear = await page.locator('.gear-loadout').boundingBox();
  const workspace = await page.locator('.gear-panel').boundingBox();
  expect(traits.y).toBeCloseTo(workspace.y, 0);
  expect(gear.y).toBeCloseTo(workspace.y, 0);
  const controls = await page.locator('.gear-loadout-controls').boundingBox();
  const trinkets = await page.locator('#trinket-slots').boundingBox();
  expect(controls.x + controls.width).toBeLessThanOrEqual(trinkets.x);
  await expect(page.locator('.gear-loadout-heading #gear-set-all')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gear', exact: true })).toHaveCount(0);
  const upgrades = await page.locator('#equipment-info').boundingBox();
  expect(upgrades.x).toBeCloseTo(trinkets.x, 0);
  expect(trinkets.y).toBeGreaterThanOrEqual(upgrades.y + upgrades.height);
  const weapons = await page.locator('#weapon-select').boundingBox();
  const consumables = await page.locator('#consumable-info').boundingBox();
  expect(consumables.x).toBeCloseTo(upgrades.x, 0);
  expect(consumables.y).toBeGreaterThanOrEqual(upgrades.y + upgrades.height);
  expect(trinkets.y).toBeGreaterThanOrEqual(consumables.y + consumables.height);
  const infusions = await page.locator('#infusion-info').boundingBox();
  expect(infusions.x).toBeCloseTo(weapons.x, 0);
  expect(infusions.y).toBeGreaterThanOrEqual(weapons.y + weapons.height);
  const attributes = await page.locator('.attributes-panel').boundingBox();
  for (const selector of ['.workspace-build-choices', '.gear-main']) {
    const panel = await page.locator(selector).boundingBox();
    expect(attributes.y).toBeCloseTo(panel.y, 0);
    expect(attributes.x).toBeGreaterThanOrEqual(panel.x + panel.width);
  }

  await expect(page.locator('#gear-character, .workspace-skill-hint')).toHaveCount(0);
  await expect(page.locator('.selectable-skills-panel')).toBeVisible();
  for (const profession of ['engineer', 'revenant']) {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    expect(
      await page
        .locator('.gear-panel')
        .evaluate((panel) =>
          ['--accent', '--bg-panel', '--text-dim'].every(
            (property) =>
              getComputedStyle(panel).getPropertyValue(property) ===
              getComputedStyle(document.body).getPropertyValue(property)
          )
        )
    ).toBe(true);
  }

  await expect(page.locator('.fixed-loadout-bar:visible')).toHaveCount(0);
  await expect(page.locator('.fixed-loadout-trigger:visible')).toHaveCount(2);
  await expect(page.locator('.selectable-skills-title')).toHaveText('Legends');
  await page.locator('.fixed-loadout-trigger').first().click();
  const legend = page
    .locator('.fixed-loadout-dropdown.open .fixed-loadout-option:not(:disabled):not(.selected)')
    .first();
  const selectedLegend = await legend.getAttribute('data-loadout-value');
  await legend.click();
  expect(await page.evaluate(() => window.professionApp.build.selectedLegends[0])).toBe(selectedLegend);
  await page.getByRole('button', { name: 'Import GW2 Build', exact: true }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
});

// Item icons retain the existing catalogs, persistence and explicit unequipped choices.
test('upgrade and consumable icons edit selections and preserve them on reload', async ({ page }) => {
  await page.goto('/guardian.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const [selector, value] of [
    ['#sel-rune', 'Scholar'],
    ['#sel-relic', 'Thief'],
    ['#sel-food', 'Bowl of Sweet and Spicy Butternut Squash Soup'],
    ['#sel-utility', 'Superior Sharpening Stone']
  ]) {
    await chooseEquipment(page, selector, value);
    const row = page.locator('.gear-icon-row').filter({ has: page.locator(selector) });
    await expect(row.locator('.gear-icon-trigger img')).toHaveCount(1);
    await expect(row.locator('.gear-equipped-name')).toHaveText(value);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#sel-rune')).toHaveValue('Scholar');
  await expect(page.locator('#sel-relic')).toHaveValue('Thief');
  await expect(page.locator('#sel-food')).toHaveValue('Bowl of Sweet and Spicy Butternut Squash Soup');
  await expect(page.locator('#sel-utility')).toHaveValue('Superior Sharpening Stone');
  const relic = page.locator('.gear-icon-row').filter({ has: page.locator('#sel-relic') });
  await relic.locator('.gear-icon-trigger').click();
  await relic.getByRole('option', { name: 'None', exact: true }).click();
  await expect(page.locator('#sel-relic')).toHaveValue('');
  await expect(relic.locator('.gear-equipped-name')).toHaveText('None');
  await expect(relic.locator('.gear-icon-trigger')).toBeFocused();
});

// The Jade Bot icon keeps the existing equipment bonus and supports mouse, keyboard and persistence.
test('Jade Bot icon toggles its core bonus and restores the saved state', async ({ page }) => {
  await page.goto('/guardian.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const toggle = page.getByRole('button', { name: 'Jade Bot core', exact: true });
  const state = toggle.locator('..').locator('.gear-equipped-name');
  await expect(toggle.locator('img')).toHaveCount(1);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(state).toHaveText('Enabled');
  const vitality = () => page.evaluate(() => window.professionApp.attributeData.attributes.Vitality.final);
  const enabledVitality = await vitality();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toBeFocused();
  await expect(state).toHaveText('Disabled');
  expect(await vitality()).toBeLessThan(enabledVitality);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(state).toHaveText('Enabled');
  expect(await vitality()).toBe(enabledVitality);
});

// Both fixed rows remain editable and share the saved 18-infusion budget.
test('two infusion rows retain selections and enforce the shared infusion limit', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.infusion-row')).toHaveCount(2);
  await expect(page.locator('#btn-add-infusion, .inf-remove')).toHaveCount(0);
  await expect(page.locator('.infusion-row').nth(0).locator('img')).toHaveAttribute('src', /\/511835\.png$/);
  await page.getByRole('spinbutton', { name: 'Infusion 1 count' }).fill('12');
  await page.keyboard.press('Tab');
  await chooseEquipment(page, '.inf-stat[data-index="1"]', 'Expertise');
  await expect(page.locator('.infusion-row').nth(1).locator('img')).toHaveAttribute('src', /\/511850\.png$/);
  await page.getByRole('spinbutton', { name: 'Infusion 2 count' }).fill('99');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('spinbutton', { name: 'Infusion 2 count' })).toHaveValue('6');
  await expect(page.locator('.inf-total')).toHaveText('18/18');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.infusion-row')).toHaveCount(2);
  expect(await page.evaluate(() => window.professionApp.build.infusions)).toEqual([
    { stat: 'Power', count: 12 },
    { stat: 'Expertise', count: 6 }
  ]);
  // Applying an optimizer allocation refreshes immediately, without requiring a reload to restore row two.
  await page.evaluate(() => {
    window.professionApp.build.infusions = [{ stat: 'Expertise', count: 18 }];
    window.professionApp.changed();
  });
  await expect(page.locator('.infusion-row')).toHaveCount(2);
  await expect(page.locator('.inf-total')).toHaveText('18/18');
});

test('both weapon sets keep their own stats and sigils when switching handedness', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const set of [1, 2]) {
    const section = page.getByRole('region', { name: `Weapon set ${set}`, exact: true });
    await chooseWeapon(page, `#sel-mh${set}`, 'Sword');
    await chooseWeapon(page, `#sel-oh${set}`, 'Focus');
    await expect(section.locator('.weapon-slot:visible')).toHaveCount(2);
    for (const slot of [0, 1]) {
      await expect(section.locator('.weapon-slot').nth(slot).locator('.weapon-sigil')).toHaveCount(1);
    }

    await chooseEquipment(page, `#sel-stat${set}-1`, "Viper's");
    await chooseEquipment(page, `#sel-stat${set}-2`, "Berserker's");
    await chooseEquipment(page, `#sel-sig${set}-1`, 'Force');
    await chooseEquipment(page, `#sel-sig${set}-2`, 'Impact');
    await chooseWeapon(page, `#sel-mh${set}`, 'Greatsword');
    await expect(section.locator('.weapon-slot:visible')).toHaveCount(1);
    await expect(section.locator('.weapon-slot:visible .weapon-sigil')).toHaveCount(2);
    await expect(page.locator(`#sel-oh${set}`)).toBeDisabled();
    await expect(page.locator(`#sel-stat${set}-1`)).toHaveValue("Viper's");
    await chooseWeapon(page, `#sel-mh${set}`, 'Sword');
    await expect(page.locator(`#sel-oh${set}`)).toBeEnabled();
    await expect(page.locator(`#sel-stat${set}-2`)).toHaveValue("Berserker's");
    await expect(page.locator(`#sel-sig${set}-1`)).toHaveValue('Force');
    await expect(page.locator(`#sel-sig${set}-2`)).toHaveValue('Impact');
  }

  await chooseEquipment(page, '.gear-prefix[data-slot="Ring1"]', 'Celestial');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(
    await page.evaluate(() => {
      const b = window.professionApp.build;
      return [b.gear.Weapon1, b.gear.Weapon2, ...b.alternateWeaponPrefixes, ...b.weaponSigils.flat(), b.gear.Ring1];
    })
  ).toEqual(["Viper's", "Berserker's", "Viper's", "Berserker's", 'Force', 'Impact', 'Force', 'Impact', 'Celestial']);
  await chooseWeapon(page, '#sel-mh2', '');
  await expect(page.locator('.weapon-set').nth(1).locator('.weapon-sigil:visible')).toHaveCount(0);
  await expect(page.locator('#attribute-preview .attribute-effects-title')).toBeVisible();
});

// The same workspace must fit desktop and phone widths for every profession's skill controls.
test('workspace regions stay within the viewport across professions', async ({ page }) => {
  for (const profession of [
    'mesmer',
    'elementalist',
    'engineer',
    'guardian',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('.infusion-row')).toHaveCount(2);
    for (const width of [1600, 1130, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 1130) {
        const traits = await page.locator('.workspace-build-choices').boundingBox();
        const equipment = await page.locator('.gear-main').boundingBox();
        const attributes = await page.locator('.attributes-panel').boundingBox();
        expect(equipment.y).toBeCloseTo(traits.y, 0);
        expect(attributes.y).toBeCloseTo(traits.y, 0);
        expect(equipment.x).toBeGreaterThanOrEqual(traits.x + traits.width);
        expect(attributes.x).toBeGreaterThanOrEqual(equipment.x + equipment.width);
      }

      for (const selector of ['.workspace-build-choices', '.gear-main', '.attributes-panel']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.x, `${profession} ${width} ${selector}`).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width, `${profession} ${width} ${selector}`).toBeLessThanOrEqual(width);
        expect(
          await page.locator(selector).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          `${profession} ${width} ${selector} overflow`
        ).toBe(true);
      }
    }
  }
});
