import { expect, test } from '@playwright/test';
import { mockGw2Icons } from '#tests/helpers/browser-icons.js';

test.beforeEach(async ({ page }) => {
  await mockGw2Icons(page);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
});

// Inspecting and opening a wiki article must never select a trait or alter the build.
test('trait overlays retain hover, open the wiki, and support keyboard dismissal', async ({ page, context }) => {
  const trait = page.locator('.spec-trait-major').first();
  const selected = await trait.getAttribute('aria-pressed');
  const name = await trait.getAttribute('aria-label');
  const panel = page.locator('#wiki-tooltip');
  await trait.hover();
  await expect(panel).toBeVisible();
  await expect(panel.locator('strong')).toHaveText(name);
  await expect(panel.locator('.wiki-tooltip-description')).not.toBeEmpty();
  await expect(trait).not.toHaveAttribute('title');
  const link = panel.getByRole('link');
  const url = `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
  await expect(link).toHaveAttribute('href', url);
  await link.hover();
  await page.waitForTimeout(250);
  await expect(panel).toBeVisible();
  await context.route('https://wiki.guildwars2.com/**', (route) => route.fulfill({ body: 'Wiki article' }));
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(url);
  await popup.close();
  await expect(trait).toHaveAttribute('aria-pressed', selected);
  await trait.focus();
  await trait.press('Tab');
  await expect(link).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trait).toBeFocused();
});

// Equipment menus use the top layer; the wiki card must remain clickable above them on narrow screens.
test('gear overlays show stats and canonical upgrade links above pickers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const display = page.locator('#sel-rune').locator('..');
  await display.locator('.gear-select-trigger').click();
  const scholar = display.locator('.gear-select-option[data-value="Scholar"]');
  await scholar.hover();
  const panel = page.locator('#wiki-tooltip');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Power');
  await expect(panel.getByRole('link')).toHaveAttribute(
    'href',
    'https://wiki.guildwars2.com/wiki/Superior_Rune_of_the_Scholar'
  );
  await panel.getByRole('link').hover();
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
});

// Skill cards stay outside the full menu, leaving adjacent choices and the wiki link reachable on either side.
for (const placement of ['right', 'left', 'vertical']) {
  test(`skill dropdown cards stay clear of options with ${placement} placement`, async ({ page }) => {
    await page.setViewportSize({ width: placement === 'vertical' ? 390 : 1280, height: 844 });
    const slot = page.locator('#skill-bar [data-key="Utility2"]');
    await slot.locator('.sbar-icon').click();
    const menu = slot.locator('.sbar-dropdown.open');
    if (placement === 'left') {
      // Exercise the same live menu against the right viewport edge.
      await menu.evaluate((element) => {
        Object.assign(element.style, {
          position: 'fixed',
          left: `${window.innerWidth - element.offsetWidth - 16}px`,
          top: '220px',
          transform: 'none'
        });
      });
    }

    const choices = menu.locator('.dd-item');
    const panel = page.locator('#wiki-tooltip');
    await choices.nth(0).hover();
    await expect(panel).toBeVisible();
    const menuBounds = await menu.boundingBox();
    const bounds = await panel.boundingBox();
    if (placement === 'right') expect(bounds.x).toBeGreaterThan(menuBounds.x + menuBounds.width);
    else if (placement === 'left') expect(bounds.x + bounds.width).toBeLessThan(menuBounds.x);
    else {
      expect(bounds.y + bounds.height < menuBounds.y || bounds.y > menuBounds.y + menuBounds.height).toBe(true);
    }

    expect(bounds.x).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(placement === 'vertical' ? 382 : 1272);
    expect(bounds.y).toBeGreaterThanOrEqual(8);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(836);
    await choices.nth(1).hover();
    // Once open, switching rows updates synchronously rather than waiting through another hover delay.
    expect(await panel.locator('strong').textContent()).toBe(await choices.nth(1).getAttribute('data-wiki-name'));
    await panel.getByRole('link').hover();
    await expect(panel).toBeVisible();
    await expect(menu).toBeVisible();
    const selected = JSON.parse(await choices.nth(0).getAttribute('data-skill-id'));
    await choices.nth(0).click();
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => window.professionApp.build.selectedSkillIds.Utility2)).toBe(selected);
  });
}

// Rotation cards wait for a deliberate hover and cancel immediately when the player adds or edits a cast.
test('rotation skill overlays are delayed and never block clicking', async ({ page }) => {
  const skill = page.locator('#skill-bar .sbar-icon').first();
  await skill.hover();
  await expect(page.locator('#wiki-tooltip')).toBeVisible();
  await expect(page.locator('#wiki-tooltip strong')).toHaveText(await skill.getAttribute('data-wiki-name'));
  const palette = page.locator('#rotation-palette .utility-palette-group .pal-skill').first();
  await palette.hover();
  await page.waitForTimeout(300);
  await expect(page.locator('#wiki-tooltip')).toBeHidden();
  await expect(page.locator('#wiki-tooltip')).toBeVisible();
  await palette.click();
  await expect(page.locator('#wiki-tooltip')).toBeHidden();
  const cast = page.locator('#rotation-timeline .rot-skill[data-idx="0"]');
  await expect(cast).toBeVisible();
  await cast.hover();
  await page.waitForTimeout(300);
  await expect(page.locator('#wiki-tooltip')).toBeHidden();
  await expect(page.locator('#wiki-tooltip')).toBeVisible();
  await cast.locator('.rot-edit-activation').click();
  await expect(page.locator('#wiki-tooltip')).toBeHidden();
  await expect(page.locator('.rotation-activation-editor:visible')).toBeVisible();
});

// Moving directly between adjacent icons must replace the card despite the old icon's pending dismissal.
test('hover hands the overlay from one item to the next', async ({ page }) => {
  // Scrolling an adjacent icon into view can deliver scroll after pointerover, while its card is still pending.
  await page.evaluate(() => {
    document.addEventListener('pointerover', (event) => {
      if (event.target.closest('.spec-trait-major')) document.dispatchEvent(new Event('scroll'));
    });
  });
  const traits = page.locator('.spec-trait-major');
  const heading = page.locator('#wiki-tooltip strong');
  for (const index of [0, 1, 2, 0]) {
    const trait = traits.nth(index);
    await trait.hover();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(await trait.getAttribute('aria-label'));
  }

  // Scrolling still dismisses an already-open card.
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(heading).toBeHidden();
  const skill = page.locator('#skill-bar .sbar-icon').first();
  await skill.hover();
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(await skill.getAttribute('data-wiki-name'));
});

// Energy follows the selected tooltip model and clears when the shared card switches to another skill.
test('Revenant energy appears beside recharge without duplicating base effects', async ({ page }) => {
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('revenant');
    const skill = adapter.profession.catalog.skillsByName.get('Beguiling Haze');
    const model = adapter.skillTooltip(skill);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [20, 0, undefined]
      .map((cost) => {
        const facts = model.facts.filter((fact) => fact.name !== 'Base energy cost');
        if (cost !== undefined) facts.push({ name: 'Base energy cost', detail: String(cost) });
        return `<button ${skillTooltipAttributes(skill, { ...model, facts })}>Inspect energy ${cost}</button>`;
      })
      .join('');
    document.body.append(wrapper);
  });
  const panel = page.locator('#wiki-tooltip');
  await page.getByRole('button', { name: 'Inspect energy 20', exact: true }).hover();
  const energy = panel.locator('.wiki-tooltip-heading .wiki-tooltip-energy');
  await expect(energy).toBeVisible();
  await expect(energy).toHaveAttribute('aria-label', 'Energy cost: 20');
  await expect(energy).toHaveText('20');
  await expect(energy.locator('img')).toHaveAttribute('src', 'https://assets.gw2dat.com/156647.png');
  await expect(panel.locator('.wiki-tooltip-recharge')).toBeVisible();
  await expect(panel.locator('.wiki-tooltip-effects')).not.toContainText('Base energy cost');
  const energyBounds = await energy.boundingBox();
  const rechargeBounds = await panel.locator('.wiki-tooltip-recharge').boundingBox();
  expect(energyBounds.x + energyBounds.width).toBeLessThan(rechargeBounds.x);
  expect(energyBounds.y).toBe(rechargeBounds.y);
  for (const cost of [0, undefined]) {
    await page.getByRole('button', { name: `Inspect energy ${cost}`, exact: true }).hover();
    await expect(panel.locator('.wiki-tooltip-energy')).toBeHidden();
    await expect(panel.locator('.wiki-tooltip-effects')).not.toContainText('Base energy cost');
  }
});

// Legend and trigger tabs isolate conditional facts while retaining shared effects and costs.
test('Revenant requirement tabs group effects and wrap within the tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { traitTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('revenant');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = ['Song of the Mists', 'Spirit Boon', 'Shared Wisdom']
      .map((name) => {
        const trait = adapter.profession.catalog.traits.find((entity) => entity.name === name);
        return `<button ${traitTooltipAttributes(trait, adapter.traitTooltip(trait))}>Inspect ${name}</button>`;
      })
      .join('');
    document.body.append(wrapper);
  });
  const panel = page.locator('#wiki-tooltip');
  const selectedEffects = panel.getByRole('tabpanel');
  const inspect = async (name) => {
    const trigger = page.getByRole('button', { name: `Inspect ${name}`, exact: true });
    await trigger.focus();
    await trigger.press('Tab');
  };

  await inspect('Song of the Mists');
  await expect(selectedEffects).toContainText('Call of the Assassin');
  await expect(selectedEffects).not.toContainText('Call of the Dwarf');
  await panel.getByRole('tab', { name: 'Assassin', exact: true }).press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Dwarf', exact: true })).toBeFocused();
  await expect(selectedEffects).toContainText('Call of the Dwarf');
  await expect(selectedEffects).not.toContainText('Call of the Assassin');
  await inspect('Spirit Boon');
  const bounds = await panel.boundingBox();
  for (const tab of await panel.getByRole('tab').all()) {
    const tabBounds = await tab.boundingBox();
    // Long legend names stay on one line; wrapping happens between complete tabs.
    await expect(tab).toHaveCSS('white-space', 'nowrap');
    expect(tabBounds.x).toBeGreaterThanOrEqual(bounds.x);
    expect(tabBounds.x + tabBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  }

  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);

  await inspect('Shared Wisdom');
  const sharedSwiftness = panel.locator('.wiki-tooltip-effects > .wiki-tooltip-fact').filter({ hasText: 'Swiftness' });
  await expect(sharedSwiftness).toBeVisible();
  await panel.getByRole('tab', { name: 'Twin Moon Sweep', exact: true }).click();
  await expect(selectedEffects).toContainText('Might');
  await expect(sharedSwiftness).toBeVisible();
});

// Rebuilding after trait selection must refresh the real skill card rather than retain a cached charge count.
test('weapon-spell skill cards refresh ally charges when Wielders Boon changes', async ({ page }) => {
  await page.goto('/necromancer.html#workspace');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const build = await (await fetch('/data/gw2/builds/necromancer/b-power-ritualist.json')).json();
    app.build = app.adapter.toApplicationBuild({ ...build, rotation: [] });
    app.changed();
  });
  const palette = page.locator('#rotation-palette');
  const tooltip = page.locator('#wiki-tooltip');
  for (const enabled of [false, true, false]) {
    await page.mouse.move(0, 0);
    await page.evaluate((enabled) => {
      const app = window.professionApp;
      app.build.specializations.find(({ name }) => name === 'Ritualist').traits = enabled ? '1-1-1' : '1-1-2';
      app.changed();
    }, enabled);
    await expect(palette).toHaveAttribute('aria-busy', 'false');
    await palette.locator('[data-skill="Nightmare Weapon"]').hover();
    await expect(tooltip).toContainText(`5 charges on yourself · ${enabled ? 5 : 3} charges on each ally`);
  }
});

// Blight alternatives remain exclusive, keyboard-accessible, and reset when inspecting another skill.
test('Harbinger effect tabs switch payloads while retaining shared costs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('necromancer');
    for (const name of ['Elixir of Risk', 'Devouring Cut']) {
      const skill = adapter.profession.catalog.skillsByName.get(name);
      const wrapper = document.createElement('div');
      wrapper.innerHTML =
        '<button ' + skillTooltipAttributes(skill, adapter.skillTooltip(skill)) + '>' + name + '</button>';
      document.body.append(wrapper);
    }
  });
  const trigger = page.getByRole('button', { name: 'Elixir of Risk', exact: true });
  await trigger.focus();
  await trigger.press('Tab');
  const panel = page.locator('#wiki-tooltip');
  const base = panel.getByRole('tab', { name: 'Base effects' });
  const enhanced = panel.getByRole('tab', { name: 'Enhanced effects' });
  const visibleEffects = panel.getByRole('tabpanel');
  await expect(base).toBeFocused();
  await expect(visibleEffects).toContainText('2 coefficient');
  await expect(visibleEffects).not.toContainText('4 coefficient');
  await base.press('ArrowRight');
  await expect(enhanced).toBeFocused();
  await expect(enhanced).toHaveAttribute('aria-selected', 'true');
  await expect(visibleEffects).toContainText('4 coefficient');
  await expect(visibleEffects).not.toContainText('2 coefficient');
  await expect(panel).toContainText('Blight required and consumed: 5');
  await expect(panel.locator('.wiki-tooltip-recharge')).toHaveAttribute('aria-label', 'Recharge: 20 seconds');
  await expect(panel).not.toContainText('Base recharge');
  await enhanced.press('Home');
  await expect(base).toBeFocused();
  await enhanced.click();
  await expect(visibleEffects).toContainText('4 coefficient');
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await enhanced.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  const next = page.getByRole('button', { name: 'Devouring Cut', exact: true });
  await next.focus();
  await next.press('Tab');
  await expect(base).toHaveAttribute('aria-selected', 'true');
});
