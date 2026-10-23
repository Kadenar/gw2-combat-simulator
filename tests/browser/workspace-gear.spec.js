import { expect, test } from '@playwright/test';
import { mockGw2Icons } from '../helpers/browser-icons.js';

// Artwork tracks specialization changes and returns to the core profession when no elite is equipped.
test('gear artwork follows the active specialization', async ({ page }) => {
  await page.goto('/engineer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const specialization of ['Amalgam', 'Scrapper', null]) {
    await page.evaluate((name) => {
      const app = window.professionApp;
      const core = app.activeCatalog.specializations.filter((spec) => !spec.elite);
      app.build.specializations = core.slice(0, 3).map((spec, index) => ({
        name: index === 2 && name ? name : spec.name,
        traits: '1-1-1'
      }));
      app.changed();
    }, specialization);
    const artwork = await page.locator('.gear-loadout').evaluate(async (panel) => {
      const background = getComputedStyle(panel, '::before').backgroundImage;
      const image = new Image();
      image.src = background.slice(5, -2);
      await image.decode();
      return { background, width: image.naturalWidth };
    });
    expect(artwork.background).toContain(`/professions/engineer/${(specialization || 'core').toLowerCase()}.png`);
    expect(artwork.width).toBeGreaterThan(0);
  }
});

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
  // Match the saved value exactly so empty weapon slots and similarly named choices remain selectable.
  await display.locator(`[role="option"][data-value="${value}"]`).click();
  await expect(page.locator(selector)).toHaveValue(value);

  if ((await editor.count()) && (await editor.isVisible())) {
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
  }
}

// Replacement edits the equipped slot, preserves queued casts, and remains accessible without a mouse.
test('skill strip above traits replaces equipped skills without queuing casts', async ({ page }) => {
  await page.goto('/necromancer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const skills = await page.locator('.selectable-skills-panel').boundingBox();
  const traits = await page.locator('.workspace-traits').boundingBox();
  expect(skills.y + skills.height).toBeLessThanOrEqual(traits.y);
  for (const key of ['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite']) {
    const slot = page.locator(`#skill-bar [data-key="${key}"]`);
    const before = await page.evaluate(() => window.professionApp.build.rotation);
    await slot.locator('.sbar-icon').click();
    const picker = slot.locator('.sbar-dropdown.open');
    await expect(picker).toBeVisible();
    const option = picker.locator('button[aria-pressed="false"]:not(:disabled)').first();
    const replacement = await option.getAttribute('data-wiki-name');
    await option.click();
    await expect(picker).toHaveCount(0);
    await expect(slot.locator('.sbar-icon')).toHaveAttribute('data-wiki-name', replacement);
    expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual(before);
  }

  const heal = page.getByRole('button', { name: 'Change heal skill', exact: true });
  await heal.focus();
  await heal.press('Enter');
  await expect(page.locator('#skill-bar [data-key="Heal"] .sbar-dropdown.open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#skill-bar .sbar-dropdown.open')).toHaveCount(0);
  // Slot edits refresh the simulation asynchronously; palette clicks are accepted only after it catches up.
  await expect(page.locator('#rotation-palette')).toHaveAttribute('data-palette-pending', 'false');
  const paletteHeal = page.locator('.utility-palette-group .pal-skill').first();
  await paletteHeal.click({ button: 'right' });
  await expect(page.locator('.rotation-skill-picker')).toHaveCount(0);
  await paletteHeal.click();
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
  const selected = await page.evaluate(() => window.professionApp.build.selectedSkillIds);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.build.selectedSkillIds)).toMatchObject(selected);
});

// Equipped choices swap in either direction, while repeated selections preserve the loadout.
test('utility selections swap slots and restore focus', async ({ page }) => {
  await page.goto('/necromancer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const selected = await page.evaluate(() => window.professionApp.build.selectedSkillIds);
  for (const [destination, source] of [
    ['Utility1', 'Utility2'],
    ['Utility3', 'Utility1'],
    ['Utility2', 'Utility3'],
    ['Utility2', 'Utility2']
  ]) {
    const slot = page.locator(`#skill-bar [data-key="${destination}"]`);
    const label = await page.evaluate(
      (id) => window.professionApp.activeCatalog.skillsById.get(id).name,
      selected[source]
    );
    await slot.locator('.sbar-icon').click();
    await slot.getByRole('button', { name: label, exact: true }).click();
    [selected[destination], selected[source]] = [selected[source], selected[destination]];
    expect(await page.evaluate(() => window.professionApp.build.selectedSkillIds)).toEqual(selected);
    await expect(slot.locator('.sbar-icon')).toHaveAttribute('data-wiki-name', label);
    await expect(slot.locator('.sbar-icon')).toBeFocused();
  }
});

// Trinkets and infusions sit beside armor, with upgrades and consumables sharing the row below.
test('workspace places trinkets above infusions and keeps build import available', async ({ page }) => {
  await page.setViewportSize({ width: 1640, height: 1100 });
  await page.goto('/engineer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#gear-slots .gear-item-icon img')).toHaveCount(6);
  await expect(page.locator('#trinket-slots .gear-item-icon img')).toHaveCount(6);
  await expect(
    page.locator('.workspace-traits-heading').getByRole('button', { name: 'Import GW2 Build', exact: true })
  ).toBeVisible();
  const traits = await page.locator('.workspace-traits').boundingBox();
  const gear = await page.locator('.gear-loadout').boundingBox();
  const workspace = await page.locator('.gear-panel').boundingBox();
  const skills = await page.locator('.selectable-skills-panel').boundingBox();
  expect(skills.y).toBeCloseTo(workspace.y, 0);
  expect(traits.y).toBeGreaterThanOrEqual(skills.y + skills.height);
  expect(gear.y).toBeCloseTo(workspace.y, 0);
  const controls = await page.locator('.gear-loadout-controls').boundingBox();
  const trinkets = await page.locator('#trinket-slots').boundingBox();
  expect(trinkets.x).toBeGreaterThanOrEqual(controls.x + controls.width);
  expect(trinkets.y).toBeCloseTo(controls.y, 0);
  await expect(page.locator('.gear-loadout-heading #gear-set-all')).toBeVisible();
  const upgrades = await page.locator('#equipment-info').boundingBox();
  expect(upgrades.x).toBeCloseTo(controls.x, 0);
  expect(upgrades.y).toBeGreaterThanOrEqual(controls.y + controls.height);
  const weapons = await page.locator('#weapon-select').boundingBox();
  const consumables = await page.locator('#consumable-info').boundingBox();
  expect(consumables.x).toBeCloseTo(trinkets.x, 0);
  expect(consumables.x).toBeGreaterThanOrEqual(upgrades.x + upgrades.width);
  expect(consumables.y).toBeCloseTo(upgrades.y, 0);
  const infusions = await page.locator('#infusion-info').boundingBox();
  expect(infusions.y).toBeGreaterThanOrEqual(trinkets.y + trinkets.height);
  expect(consumables.y).toBeGreaterThanOrEqual(infusions.y + infusions.height);
  const trinketRows = await page.locator('.trinket-grid .gear-icon-row').evaluateAll((rows) =>
    rows.map((row) => ({
      slot: row.querySelector('select').dataset.slot,
      top: row.getBoundingClientRect().top
    }))
  );
  expect(trinketRows.map((row) => row.slot)).toEqual(['Back', 'Accessory1', 'Accessory2', 'Amulet', 'Ring1', 'Ring2']);
  expect(trinketRows.slice(0, 3).every((row) => row.top === trinketRows[0].top)).toBe(true);
  expect(trinketRows.slice(3).every((row) => row.top === trinketRows[3].top)).toBe(true);
  expect(trinketRows[3].top).toBeGreaterThan(trinketRows[0].top);
  expect(infusions.x).toBeCloseTo(trinkets.x, 0);
  expect(weapons.x).toBeCloseTo(controls.x, 0);
  expect(weapons.y).toBeGreaterThanOrEqual(controls.y + controls.height);
  expect(weapons.y).toBeGreaterThanOrEqual(infusions.y + infusions.height);
  expect(upgrades.y).toBeGreaterThanOrEqual(weapons.y + weapons.height);
  await expect(page.locator('.gear-loadout #weapon-select')).toBeVisible();
  const attributes = await page.locator('.attributes-panel').boundingBox();
  for (const selector of ['.workspace-build-choices', '.gear-main']) {
    const panel = await page.locator(selector).boundingBox();
    expect(attributes.y).toBeCloseTo(panel.y, 0);
    expect(attributes.x).toBeGreaterThanOrEqual(panel.x + panel.width);
  }

  await expect(page.locator('#skill-bar .skill-bar-slot[data-key]')).toHaveCount(5);
  // The gear panel inherits the profession theme rather than defining its own palette.
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
  // Icon selection is an application contract independent of the external render server's availability.
  await mockGw2Icons(page);
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.infusion-row')).toHaveCount(2);
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
    await chooseEquipment(page, `#sel-mh${set}`, 'Sword');
    await chooseEquipment(page, `#sel-oh${set}`, 'Focus');
    await expect(section.locator('.weapon-slot:visible')).toHaveCount(2);
    const mainHand = await section.locator('.weapon-slot').nth(0).boundingBox();
    const offHand = await section.locator('.weapon-slot').nth(1).boundingBox();
    expect(offHand.y).toBeCloseTo(mainHand.y, 0);
    expect(offHand.x).toBeGreaterThanOrEqual(mainHand.x + mainHand.width);
    for (const slot of [0, 1]) {
      await expect(section.locator('.weapon-slot').nth(slot).locator('.weapon-sigil')).toHaveCount(1);
    }

    await chooseEquipment(page, `#sel-stat${set}-1`, "Viper's");
    await chooseEquipment(page, `#sel-stat${set}-2`, "Berserker's");
    await chooseEquipment(page, `#sel-sig${set}-1`, 'Force');
    await chooseEquipment(page, `#sel-sig${set}-2`, 'Impact');
    await chooseEquipment(page, `#sel-mh${set}`, 'Greatsword');
    await expect(section.locator('.weapon-slot:visible')).toHaveCount(1);
    await expect(section.locator('.weapon-slot:visible .weapon-sigil')).toHaveCount(2);
    await expect(page.locator(`#sel-oh${set}`)).toBeDisabled();
    await expect(page.locator(`#sel-stat${set}-1`)).toHaveValue("Viper's");
    await chooseEquipment(page, `#sel-mh${set}`, 'Sword');
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
  await chooseEquipment(page, '#sel-mh2', '');
  await expect(page.locator('.weapon-set').nth(1).locator('.weapon-sigil:visible')).toHaveCount(0);
  await expect(page.locator('#attribute-preview .attribute-effects-title')).toBeVisible();
});
