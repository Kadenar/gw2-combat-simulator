import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/mesmer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    Object.assign(app.build, {
      rune: 'Balthazar',
      relic: 'Warrior',
      weapons: ['Sword', 'Pistol'],
      alternateWeapons: ['Staff', ''],
      alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
      weaponSigils: [
        ['Force', 'Bursting'],
        ['Accuracy', 'Impact']
      ],
      infusions: [{ stat: 'Power', count: 18 }]
    });
    for (const slot of ['Helm', 'Back', 'Weapon1', 'Weapon2']) app.build.gear[slot] = "Berserker's";
    app.changed();
  });
});

// Item stats exclude unassigned infusions, and native changes refresh the same keyboard-accessible trigger.
test('armor and trinket cards show slot stats and only armor carries the rune set', async ({ page }) => {
  const panel = page.locator('#wiki-tooltip');
  const helm = page.locator('.gear-prefix[data-slot="Helm"]').locator('..').locator('.gear-select-trigger');
  await helm.focus();
  await expect(panel).toBeVisible();
  await expect(panel.locator('strong')).toHaveText("Berserker's Helm");
  await expect(panel.locator('.wiki-tooltip-item-icon')).toBeVisible();
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Power: +63');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('Superior Rune of Balthazar (6/6)');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('+50% Burning Duration');
  await expect(panel).not.toContainText('Infusion');

  await page.keyboard.press('Escape');
  await helm.click();
  await page
    .locator('.gear-prefix[data-slot="Helm"]')
    .locator('..')
    .getByRole('option', { name: /^Viper's/ })
    .click();
  await helm.hover();
  await expect(panel.locator('strong')).toHaveText("Viper's Helm");
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Expertise');
  await expect(panel.locator('.wiki-tooltip-effects')).not.toContainText('Ferocity');

  await page.keyboard.press('Escape');
  await page.locator('.gear-prefix[data-slot="Back"]').locator('..').locator('.gear-select-trigger').hover();
  await expect(panel.locator('strong')).toHaveText("Berserker's Back item");
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Precision: +40');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toBeHidden();

  await page.keyboard.press('Escape');
  await page.locator('#sel-rune').selectOption('', { force: true });
  await page.locator('.gear-prefix[data-slot="Helm"]').locator('..').locator('.gear-select-trigger').hover();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.wiki-tooltip-upgrades')).toBeHidden();
  await expect(page.locator('#sel-rune').locator('..').locator('.gear-select-trigger')).not.toHaveAttribute(
    'data-wiki-equipment'
  );
});

// Every equipment picker keeps its entire list reachable while the card follows hovered choices.
for (const width of [1440, 390]) {
  test(`equipment picker tooltips stay outside their menus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const panel = page.locator('#wiki-tooltip');
    for (const selector of [
      '.gear-prefix[data-slot="Chest"]',
      '#sel-rune',
      '#sel-relic',
      '#sel-sig1-1',
      '#sel-food',
      '#sel-stat1-1'
    ]) {
      if (selector === '#sel-stat1-1') {
        await page.locator('.weapon-icon-trigger[popovertarget="weapon-editor-1-0"]').click();
      }

      const select = page.locator(selector);
      const display = select.locator('..');
      await display.locator(':scope > .gear-select-trigger').click();
      const menu = display.locator(':scope > .gear-select-menu');
      const choices = menu.locator('.gear-select-option[data-wiki-name]:not(:disabled)');
      await choices.nth(0).hover();
      await expect(panel).toBeVisible();
      const menuBounds = await menu.boundingBox();
      const bounds = await panel.boundingBox();
      expect(
        bounds.x + bounds.width < menuBounds.x ||
          bounds.x > menuBounds.x + menuBounds.width ||
          bounds.y + bounds.height < menuBounds.y ||
          bounds.y > menuBounds.y + menuBounds.height
      ).toBe(true);
      expect(bounds.x).toBeGreaterThanOrEqual(8);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 8);
      expect(bounds.y).toBeGreaterThanOrEqual(8);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(992);
      await choices.nth(1).hover();
      expect(await panel.locator('strong').textContent()).toBe(await choices.nth(1).getAttribute('data-wiki-name'));
      await panel.getByRole('link').hover();
      await expect(panel).toBeVisible();
      await expect(menu).toBeVisible();
      const selected = await choices.nth(0).getAttribute('data-value');
      await choices.nth(0).click();
      await expect(select).toHaveValue(selected);
      await expect(menu).toBeHidden();
    }
  });
}

// Each weapon owns its actual sockets, including the alternate set, while relic cards use their catalog effect.
test('weapon and relic cards show the selected equipment and refresh after editing', async ({ page }) => {
  const panel = page.locator('#wiki-tooltip');
  const weapon = (set, slot) => page.locator(`.weapon-icon-trigger[popovertarget="weapon-editor-${set}-${slot}"]`);
  await weapon(1, 0).hover();
  await expect(panel.locator('strong')).toHaveText("Berserker's Sword");
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Weapon Strength: 950 – 1050');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('Superior Sigil of Force');
  await expect(panel).not.toContainText('Bursting');
  await page.keyboard.press('Escape');
  await weapon(1, 1).hover();
  await expect(panel.locator('strong')).toHaveText("Berserker's Pistol");
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('Superior Sigil of Bursting');
  await expect(panel).not.toContainText('Superior Sigil of Force');

  await page.keyboard.press('Escape');
  await weapon(2, 0).hover();
  await expect(panel.locator('strong')).toHaveText("Berserker's Staff");
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Power: +251');
  await expect(panel.locator('.wiki-tooltip-upgrades .wiki-tooltip-fact')).toHaveCount(2);
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('Superior Sigil of Accuracy');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toContainText('Superior Sigil of Impact');
  await page.keyboard.press('Escape');
  await weapon(2, 0).click();
  await page.locator('#sel-stat2-1').selectOption("Viper's", { force: true });
  await page.getByRole('button', { name: 'Close weapon picker' }).filter({ visible: true }).click();
  await weapon(2, 0).hover();
  await expect(panel.locator('strong')).toHaveText("Viper's Staff");
  await expect(panel.locator('.wiki-tooltip-effects')).toContainText('Expertise');

  await page.keyboard.press('Escape');
  await page.locator('#sel-relic').locator('..').locator('.gear-select-trigger').hover();
  await expect(panel.locator('strong')).toHaveText('Relic of the Warrior');
  await expect(panel.locator('.wiki-tooltip-description')).toHaveText('Reduce weapon swap recharge by 2.5 seconds');
  await expect(panel.locator('.wiki-tooltip-upgrades')).toBeHidden();
  await expect(panel.getByRole('link')).toHaveAttribute(
    'href',
    'https://wiki.guildwars2.com/wiki/Relic_of_the_Warrior'
  );
});
