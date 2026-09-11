import { expect, test } from '@playwright/test';

// Artwork tracks specialization changes and returns to the core profession when no elite is equipped.
test('gear artwork follows the active specialization', async ({ page }) => {
  await page.goto('/engineer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const specialization of ['Amalgam', 'Scrapper', null]) {
    await page.evaluate((name) => {
      const app = window.professionApp;
      const core = app.specializations.filter((spec) => !spec.elite);
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
    expect(artwork.background).toContain(`/professions/${(specialization || 'engineer').toLowerCase()}.png`);
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
    const replacement = await option.getAttribute('data-name');
    await option.click();
    await expect(picker).toHaveCount(0);
    await expect(slot.locator('.sbar-icon')).toHaveAttribute('title', replacement);
    expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual(before);
  }

  const heal = page.getByRole('button', { name: 'Change heal skill', exact: true });
  await heal.focus();
  await heal.press('Enter');
  await expect(page.locator('#skill-bar [data-key="Heal"] .sbar-dropdown.open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#skill-bar .sbar-dropdown.open')).toHaveCount(0);
  const paletteHeal = page.locator('.utility-palette-group .pal-skill').first();
  await paletteHeal.click({ button: 'right' });
  await expect(page.locator('.rotation-skill-picker')).toHaveCount(0);
  await paletteHeal.click();
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
  const selected = await page.evaluate(() => window.professionApp.build.selectedSkills);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.build.selectedSkills)).toMatchObject(selected);
});

// Equipped choices swap in either direction, while repeated selections preserve the loadout.
test('utility selections swap slots and normalization repairs duplicate or unavailable picks', async ({ page }) => {
  await page.goto('/necromancer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const selected = await page.evaluate(() => window.professionApp.build.selectedSkills);
  for (const [destination, source] of [
    ['Utility1', 'Utility2'],
    ['Utility3', 'Utility1'],
    ['Utility2', 'Utility3'],
    ['Utility2', 'Utility2']
  ]) {
    const slot = page.locator(`#skill-bar [data-key="${destination}"]`);
    await slot.locator('.sbar-icon').click();
    await slot.getByRole('button', { name: selected[source], exact: true }).click();
    [selected[destination], selected[source]] = [selected[source], selected[destination]];
    expect(await page.evaluate(() => window.professionApp.build.selectedSkills)).toEqual(selected);
    await expect(slot.locator('.sbar-icon')).toHaveAttribute('title', selected[destination]);
    await expect(slot.locator('.sbar-icon')).toBeFocused();
  }

  // Normalization must also reserve valid later picks when repairing earlier invalid slots.
  for (const invalid of [selected.Utility1, 'Unavailable utility']) {
    const repaired = await page.evaluate((name) => {
      const app = window.professionApp;
      app.build.selectedSkills.Utility1 = name;
      app.build.selectedSkills.Utility2 = name;
      app.changed();
      return app.build.selectedSkills;
    }, invalid);
    expect(repaired.Utility3).toBe(selected.Utility3);
    const utilities = [repaired.Utility1, repaired.Utility2, repaired.Utility3];
    expect(utilities.every(Boolean)).toBe(true);
    expect(new Set(utilities).size).toBe(3);
    expect(utilities).not.toContain('Unavailable utility');
  }
});

// A flipped skill still edits its equipped root through the selector above traits.
test('flipped utility skills remain replaceable from the skill strip', async ({ page }) => {
  await page.goto('/necromancer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.selectedSkills.Utility1 = 'Summon Bone Minions';
    app.build.rotation = [];
    app.changed();
  });
  const first = page.locator('#skill-bar [data-key="Utility1"]');
  await page.locator('.utility-palette-group .pal-skill[data-skill="Summon Bone Minions"]').click();
  await expect(page.locator('.utility-palette-group .pal-skill[data-skill="Putrid Explosion"]')).toBeVisible();
  await first.locator('.sbar-icon').click();
  const option = first.locator('.sbar-dropdown button[aria-pressed="false"]:not(:disabled)').first();
  const replacement = await option.getAttribute('data-name');
  await option.click();
  expect(await page.evaluate(() => window.professionApp.build.selectedSkills.Utility1)).toBe(replacement);
  await expect(first.locator('.sbar-icon')).toHaveAttribute('title', replacement);
});

// Trinkets and infusions sit beside armor, with upgrades and consumables sharing the row below.
test('workspace places trinkets above infusions and keeps import available without Revenant skills', async ({
  page
}) => {
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
  const skills = await page.locator('.selectable-skills-panel').boundingBox();
  expect(skills.y).toBeCloseTo(workspace.y, 0);
  expect(traits.y).toBeGreaterThanOrEqual(skills.y + skills.height);
  expect(gear.y).toBeCloseTo(workspace.y, 0);
  const controls = await page.locator('.gear-loadout-controls').boundingBox();
  const trinkets = await page.locator('#trinket-slots').boundingBox();
  expect(trinkets.x).toBeGreaterThanOrEqual(controls.x + controls.width);
  expect(trinkets.y).toBeCloseTo(controls.y, 0);
  await expect(page.locator('.gear-loadout-heading #gear-set-all')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gear', exact: true })).toHaveCount(0);
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

  await expect(page.locator('#gear-character, .workspace-skill-hint')).toHaveCount(0);
  await expect(page.locator('#skill-bar .skill-bar-slot[data-key]')).toHaveCount(5);
  await expect(page.locator('.weapon-sigil .gear-label:visible')).toHaveCount(0);
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
  const legendButtons = page.locator('.fixed-loadout-trigger');
  for (const button of await legendButtons.all()) {
    await expect(button).toHaveCSS('width', '52px');
    await expect(button).toHaveCSS('height', '52px');
    await expect(button).toHaveAttribute('aria-label', /^Change legend [12]: /);
  }

  const firstLegend = await legendButtons.first().boundingBox();
  const secondLegend = await legendButtons.nth(1).boundingBox();
  expect(secondLegend.y).toBeCloseTo(firstLegend.y, 0);
  expect(secondLegend.x).toBeGreaterThanOrEqual(firstLegend.x + firstLegend.width);
  await expect(page.locator('.selectable-skills-title')).toHaveText('Legends');
  await page.locator('.fixed-loadout-trigger').first().click();
  const legend = page
    .locator('.fixed-loadout-dropdown.open .fixed-loadout-option:not(:disabled):not(.selected)')
    .first();
  const selectedLegend = await legend.getAttribute('data-loadout-value');
  const selectedLegendName = await legend.locator('span').textContent();
  await legend.click();
  expect(await page.evaluate(() => window.professionApp.build.selectedLegends[0])).toBe(selectedLegend);
  await expect(legendButtons.first()).toHaveAttribute('title', selectedLegendName);
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

// Non-swapping professions keep stacking gear saved while only their starting weapon enters the rotation.
for (const profession of ['elementalist', 'engineer']) {
  test(`${profession} supports inactive stacking gear and either starting set`, async ({ page }) => {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await page.evaluate(() => {
      const app = window.professionApp;
      app.build.rotation = [];
      app.build.startingWeaponSet = 1;
      if (app.adapter.id === 'engineer') {
        app.build.selectedSkills.Utility1 = 'Grenade Kit';
        app.build.selectedSkills.Utility2 = 'Bomb Kit';
      }

      app.build.weaponSigils = [
        ['Force', 'Accuracy'],
        ['Force', 'Accuracy']
      ];
      app.changed();
    });
    const alternate = profession === 'elementalist' ? 'Staff' : 'Pistol';
    const alternateSkill = profession === 'elementalist' ? 'Fireball' : 'Static Shot';
    await chooseWeapon(page, '#sel-mh2', alternate);
    await chooseEquipment(page, '#sel-stat2-1', 'Celestial');
    await chooseEquipment(page, '#sel-sig2-1', 'Corruption');
    expect(await page.evaluate(() => window.professionApp.attributeData.attributes['Condition Damage'].sigils)).toBe(
      250
    );
    await expect(page.locator(`#rotation-palette .pal-skill[data-skill="${alternateSkill}"]`)).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#sel-mh2')).toHaveValue(alternate);
    await expect(page.locator('#sel-stat2-1')).toHaveValue('Celestial');
    await expect(page.locator('#sel-sig2-1')).toHaveValue('Corruption');
    // Kit rows must survive hiding either equipment set and still allow entering and using the kit.
    if (profession === 'engineer') {
      await expect(page.locator('#rotation-palette .pal-skill[data-skill="Grenade"]')).toBeVisible();
      await expect(page.locator('#rotation-palette .pal-skill[data-skill="Bomb"]')).toBeVisible();
    }

    await page.locator('.weapon-set-btn[data-set="2"]').click();
    if (profession === 'engineer') {
      await expect(page.locator('#rotation-palette .pal-skill[data-skill="Grenade"]')).toBeVisible();
      await expect(page.locator('#rotation-palette .pal-skill[data-skill="Bomb"]')).toBeVisible();
    }

    const skill = page.locator(`#rotation-palette .pal-skill[data-skill="${alternateSkill}"]`).first();
    await expect(skill).toBeVisible();
    await expect(skill).not.toHaveClass(/unavailable/);
    await skill.click();
    expect(await page.evaluate(() => window.professionApp.results.endState.activeWeaponSet)).toBe(2);
    expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
    if (profession === 'engineer') {
      await page.locator('.utility-palette-group .pal-skill[data-skill="Grenade Kit"]').click();
      await expect
        .poll(() => page.evaluate(() => window.professionApp.results.endState.profession.activeKit))
        .toBe('Grenade Kit');
      await page.locator('#rotation-palette .pal-skill[data-skill="Grenade"]').click();
      await expect
        .poll(() => page.evaluate(() => window.professionApp.results.steps.some((step) => step.skill === 'Grenade')))
        .toBe(true);
      expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
    }
  });
}

test('both weapon sets keep their own stats and sigils when switching handedness', async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const set of [1, 2]) {
    const section = page.getByRole('region', { name: `Weapon set ${set}`, exact: true });
    await chooseWeapon(page, `#sel-mh${set}`, 'Sword');
    await chooseWeapon(page, `#sel-oh${set}`, 'Focus');
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

// Profession selectors share the desktop skill strip and wrap below it on phones.
test('profession selectors stay compact beside skills and wrap on phones', async ({ page }) => {
  for (const profession of ['engineer', 'ranger', 'elementalist']) {
    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    if (profession === 'engineer' || profession === 'elementalist') {
      const picker = page.locator('.spec-picker').last();
      await picker.locator('summary').click();
      await picker.getByRole('button', { name: profession === 'engineer' ? 'Amalgam' : 'Evoker', exact: true }).click();
    }

    const selections = page.locator('.profession-build-selections');
    const skills = page.locator('#skill-bar > .skill-bar-selected');
    const icons = selections.locator('.sbar-icon');
    await expect(icons.first()).toBeVisible();
    const standardIcon = await skills.locator('.sbar-icon').first().boundingBox();
    for (const icon of await icons.all()) {
      await expect(icon).toHaveCSS('width', `${standardIcon.width}px`);
      await expect(icon).toHaveCSS('height', `${standardIcon.height}px`);
    }

    const wideSkills = await skills.boundingBox();
    const wideSelections = await selections.boundingBox();
    const labels = selections.locator('.skill-bar-inspection-label');
    expect(await labels.evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth))).toBe(true);
    expect(wideSelections.x).toBeGreaterThanOrEqual(wideSkills.x + wideSkills.width);
    expect(wideSelections.y).toBeLessThan(wideSkills.y + wideSkills.height);
    await icons.first().click();
    await expect(selections.locator('.sbar-dropdown.open')).toBeVisible();
    await page.locator('.selectable-skills-title').click();
    await page.setViewportSize({ width: 390, height: 1000 });
    const narrowSkills = await skills.boundingBox();
    const narrowSelections = await selections.boundingBox();
    expect(await labels.evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth))).toBe(true);
    const narrowIcon = await skills.locator('.sbar-icon').first().boundingBox();
    await expect(icons.first()).toHaveCSS('width', `${narrowIcon.width}px`);
    await expect(icons.first()).toHaveCSS('height', `${narrowIcon.height}px`);
    expect(narrowSelections.y).toBeGreaterThanOrEqual(narrowSkills.y + narrowSkills.height);
    expect(narrowSelections.x + narrowSelections.width).toBeLessThanOrEqual(390);
  }
});

// The visible familiar selector drives F5 and survives reloading the saved build.
test('Evoker familiar selection updates Skills and the rotation palette', async ({ page }) => {
  await page.goto('/elementalist.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const picker = page.locator('.spec-picker').last();
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Evoker', exact: true }).click();
  const selector = page.locator('#skill-bar [data-selection-key="evokerElement"]');
  for (const [element, skill] of [
    ['Air', 'Zap'],
    ['Water', 'Splash'],
    ['Earth', 'Calcify'],
    ['Fire', 'Ignite']
  ]) {
    await selector.locator('.sbar-icon').click();
    await selector.locator(`[data-selection-value="${element}"]`).click();
    expect(await page.evaluate(() => window.professionApp.build.evokerElement)).toBe(element);
    await expect(page.locator('#skill-bar .skill-bar-inspection-label')).toHaveText(`${element} Familiar`);
    await expect(page.locator(`#rotation-palette .pal-skill[data-skill="${skill}"]`)).toBeVisible();
  }

  await selector.locator('.sbar-icon').click();
  await selector.locator('[data-selection-value="Air"]').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.build.evokerElement)).toBe('Air');
  await expect(page.locator('#skill-bar .skill-bar-inspection-label')).toHaveText('Air Familiar');
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
