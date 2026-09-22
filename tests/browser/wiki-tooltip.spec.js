import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
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
    const selected = await choices.nth(0).getAttribute('data-name');
    await choices.nth(0).click();
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => window.professionApp.build.selectedSkills.Utility2)).toBe(selected);
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
  const traits = page.locator('.spec-trait-major');
  const heading = page.locator('#wiki-tooltip strong');
  for (const index of [0, 1, 2, 0]) {
    const trait = traits.nth(index);
    await trait.hover();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(await trait.getAttribute('aria-label'));
  }

  const skill = page.locator('#skill-bar .sbar-icon').first();
  await skill.hover();
  await expect(heading).toHaveText(await skill.getAttribute('data-wiki-name'));
});

// Explicit presentation models retain icons and ignore external entity descriptions.
test('simulation effect cards preserve repeated applications and semantic icons', async ({ page }) => {
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { describeSimulationSkill } = await import('/js/games/gw2/app/shared/simulation-tooltip.ts');
    const skill = {
      id: 'tooltip-check',
      name: 'Example attack',
      description: 'EXTERNAL TEXT MUST NOT APPEAR',
      cooldown: 12,
      ammo: 2,
      effects: [
        {
          type: 'strike',
          ticks: [
            { atMs: 0, coefficient: 0.2 },
            { atMs: 100, coefficient: 0.3 }
          ]
        },
        { type: 'condition', condition: 'Burning', stacks: 2, duration: 10, applications: 2 },
        { type: 'boon', boon: 'Might', stacks: 3, duration: 6 },
        { type: 'boon', boon: 'Quickness', duration: 4 }
      ]
    };
    const model = describeSimulationSkill({}, skill, { traits: {} });
    const button = document.createElement('div');
    button.innerHTML =
      '<button id="effect-tooltip-check" ' + skillTooltipAttributes(skill, model) + '>Inspect</button>';
    document.body.append(button);
  });
  await page.locator('#effect-tooltip-check').hover();
  const panel = page.locator('#wiki-tooltip');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('0.5 coefficient total · 2 hits');
  await expect(panel).toContainText('Burning: 10s × 2 applications');
  await expect(panel).not.toContainText('stacks');
  for (const [name, stacks] of [
    ['Burning', 2],
    ['Might', 3]
  ]) {
    const row = panel.locator('.wiki-tooltip-fact').filter({ hasText: name });
    await expect(row.locator('.wiki-tooltip-fact-icon .wiki-tooltip-fact-stacks')).toHaveText(String(stacks));
    await expect(row.getByRole('img', { name: `${stacks} stacks of ${name}` })).toBeVisible();
  }

  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Quickness' }).locator('.wiki-tooltip-fact-stacks')
  ).toHaveCount(0);
  await expect(panel).not.toContainText('EXTERNAL TEXT');
  for (const name of ['Strike damage', 'Burning', 'Might']) {
    await expect(panel.locator('.wiki-tooltip-fact').filter({ hasText: name }).locator('img')).toHaveAttribute(
      'src',
      /^https:[/][/]render[.]guildwars2[.]com[/]file[/]/
    );
  }

  await expect(panel.locator('.wiki-tooltip-recharge')).toHaveAttribute('aria-label', 'Recharge: 12 seconds');
  await expect(panel).not.toContainText('Base ammunition recharge');
  await expect(
    panel
      .locator('.wiki-tooltip-fact')
      .filter({ hasText: /^Ammunition:/ })
      .locator('img')
  ).toHaveAttribute('src', 'https://render.guildwars2.com/file/B4490FB81AA1E7C06F1B22056AE09A0F54CBE2C4/1770201.png');
  await expect(panel.locator('.wiki-tooltip-recharge img')).toHaveAttribute(
    'src',
    /D767B963D120F077C3B163A05DC05A7317D7DB70\/156651\.png$/
  );
});

// Energy follows the selected tooltip model and clears when the shared card switches to another skill.
test('Revenant energy appears beside recharge without duplicating base effects', async ({ page }) => {
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
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

// Shared facts retain distinct game icons without exposing internal simulation limits.
test('control and Revenant buff facts use game icons with concise details', async ({ page }) => {
  const controls = {
    daze: 433474,
    stun: 522727,
    knockdown: 2440716,
    knockback: 2440715,
    pull: 2440717,
    launch: 2440712,
    float: 2440713,
    sink: 2440714,
    fear: 102869,
    taunt: 1228472,
    immobilize: 102844,
    blind: 102837,
    control: 1938788,
    'crowd-control': 1938788,
    defiance: 1938788
  };
  await page.evaluate(async (controls) => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { describeSimulationSkill } = await import('/js/games/gw2/app/shared/simulation-tooltip.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('revenant');
    const wrapper = document.createElement('div');
    const controlSkill = {
      id: 'control-icons',
      name: 'Control icons',
      effects: Object.keys(controls).map((controlKind) => ({ type: 'control', controlKind }))
    };
    wrapper.innerHTML =
      `<button ${skillTooltipAttributes(controlSkill, describeSimulationSkill({}, controlSkill, { traits: {} }))}>Inspect controls</button>` +
      ['Abyssal Raze', 'Release Potential: Mesmer']
        .map((name) => {
          const skill = adapter.profession.catalog.skillsByName.get(name);
          return `<button ${skillTooltipAttributes(skill, adapter.skillTooltip(skill))}>Inspect ${name}</button>`;
        })
        .join('');
    document.body.append(wrapper);
  }, controls);
  const panel = page.locator('#wiki-tooltip');
  await page.getByRole('button', { name: 'Inspect controls', exact: true }).hover();
  const rows = panel.locator('.wiki-tooltip-fact');
  for (const [index, iconId] of Object.values(controls).entries()) {
    await expect(rows.nth(index).locator('img')).toHaveAttribute('src', new RegExp(`/${iconId}\\.png$`));
  }

  await expect(panel).not.toContainText('disable duration');
  await page.getByRole('button', { name: 'Inspect Abyssal Raze', exact: true }).hover();
  await expect(
    panel
      .locator('.wiki-tooltip-fact')
      .filter({ hasText: /Crushing abyss:/i })
      .locator('img')
  ).toHaveAttribute('src', 'https://render.guildwars2.com/file/632F757C2309C12BCFE99FCCE4BB761FA59AECEE/3379187.png');
  await page.getByRole('button', { name: 'Inspect Release Potential: Mesmer', exact: true }).hover();
  await expect(panel.locator('strong')).toHaveText('Release Potential: Mesmer');
  await expect(panel).not.toContainText('Maximum effective affinity');
  await expect(panel).not.toContainText('disable duration');
  await expect(panel.locator('.wiki-tooltip-fact').filter({ hasText: /^Daze/ }).locator('img')).toHaveAttribute(
    'src',
    /\/433474\.png$/
  );
});

// Condition-dependent resources use numeric fact icons, and recharge appears only in the heading.
test('Devouring Darkness shows its condition threshold and per-condition life force', async ({ page }) => {
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('necromancer');
    const skill = adapter.profession.catalog.skillsByName.get('Devouring Darkness');
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<button ' + skillTooltipAttributes(skill, adapter.skillTooltip(skill)) + '>Inspect darkness</button>';
    document.body.append(wrapper);
  });
  await page.getByRole('button', { name: 'Inspect darkness' }).hover();
  const panel = page.locator('#wiki-tooltip');
  for (const label of ['Condition Threshold: 5', 'Life force per condition: 1% life force']) {
    const row = panel.locator('.wiki-tooltip-fact').filter({ hasText: label });
    await expect(row).toBeVisible();
    await expect(row.locator('img')).toHaveAttribute(
      'src',
      'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png'
    );
  }

  await expect(panel.locator('.wiki-tooltip-recharge')).toHaveAttribute('aria-label', 'Recharge: 10 seconds');
  await expect(panel).not.toContainText('Base recharge');
});

// Legend and trigger tabs isolate conditional facts while retaining shared effects and costs.
test('Revenant requirement tabs group effects and wrap within the tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { skillTooltipAttributes, traitTooltipAttributes } =
      await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('revenant');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
      'Song of the Mists',
      'Spirit Boon',
      'Shared Wisdom',
      'Numinous Gift',
      'Ambush Commander',
      'Lasting Legacy'
    ]
      .map((name) => {
        const trait = adapter.profession.catalog.traits.find((entity) => entity.name === name);
        return `<button ${traitTooltipAttributes(trait, adapter.traitTooltip(trait))}>Inspect ${name}</button>`;
      })
      .join('');
    const skill = adapter.profession.catalog.skillsByName.get('Ancient Echo');
    wrapper.innerHTML += `<button ${skillTooltipAttributes(skill, adapter.skillTooltip(skill))}>Inspect Ancient Echo</button>`;
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
  await expect(panel.getByRole('tab')).toHaveText([
    'Assassin',
    'Dwarf',
    'Demon',
    'Centaur',
    'Dragon',
    'Alliance',
    'Renegade',
    'Entity'
  ]);
  await expect(selectedEffects).toContainText('Call of the Assassin');
  await expect(selectedEffects).not.toContainText('Call of the Dwarf');
  await panel.getByRole('tab', { name: 'Assassin', exact: true }).press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Dwarf', exact: true })).toBeFocused();
  await expect(selectedEffects).toContainText('Call of the Dwarf');
  await expect(selectedEffects).not.toContainText('Call of the Assassin');
  await panel.getByRole('tab', { name: 'Demon', exact: true }).click();
  await expect(selectedEffects).toContainText('Call of the Demon');
  await panel.getByRole('tab', { name: 'Dragon', exact: true }).click();
  await expect(selectedEffects).toContainText('Call of the Dragon');
  await expect(selectedEffects).toContainText('Burning');
  await panel.getByRole('tab', { name: 'Alliance', exact: true }).click();
  await expect(selectedEffects).toContainText('Call of the Alliance');
  await expect(selectedEffects).toContainText('Endurance gained');
  await panel.getByRole('tab', { name: 'Renegade', exact: true }).click();
  await expect(selectedEffects).toContainText('Call of the Renegade');
  await expect(selectedEffects).toContainText('Bleeding');
  await expect(selectedEffects).toContainText("Kalla's Fervor");
  await panel.getByRole('tab', { name: 'Centaur', exact: true }).click();
  await expect(selectedEffects).toContainText('Healing is outside simulation scope');
  await panel.getByRole('tab', { name: 'Entity', exact: true }).click();
  await expect(selectedEffects).toContainText('other equipped legend');

  await inspect('Spirit Boon');
  const bounds = await panel.boundingBox();
  for (const tab of await panel.getByRole('tab').all()) {
    const tabBounds = await tab.boundingBox();
    // Long legend names stay on one line; wrapping happens between complete tabs.
    await expect(tab).toHaveCSS('white-space', 'nowrap');
    expect(tabBounds.x).toBeGreaterThanOrEqual(bounds.x);
    expect(tabBounds.x + tabBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    await tab.click();
    await expect(selectedEffects.locator('.wiki-tooltip-fact')).not.toHaveCount(0);
  }

  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);

  await inspect('Shared Wisdom');
  const sharedSwiftness = panel.locator('.wiki-tooltip-effects > .wiki-tooltip-fact').filter({ hasText: 'Swiftness' });
  await expect(sharedSwiftness).toBeVisible();
  await panel.getByRole('tab', { name: 'Twin Moon Sweep', exact: true }).click();
  await expect(selectedEffects).toContainText('Might');
  await expect(sharedSwiftness).toBeVisible();

  await inspect('Numinous Gift');
  await panel.getByRole('tab', { name: 'Demon', exact: true }).click();
  await expect(selectedEffects).toContainText('Resistance');
  await expect(panel.locator('.wiki-tooltip-effects > .wiki-tooltip-fact').filter({ hasText: 'Might' })).toBeVisible();

  await inspect('Ancient Echo');
  await panel.getByRole('tab', { name: 'Demon', exact: true }).click();
  await expect(
    panel.locator('.wiki-tooltip-effects > .wiki-tooltip-fact').filter({ hasText: 'Energy restored' })
  ).toBeVisible();
  await expect(panel.locator('.wiki-tooltip-recharge')).toBeVisible();
  // Both Fervor duration variants resolve the authored buff ID to the same named effect icon.
  for (const name of ['Ambush Commander', 'Lasting Legacy']) {
    await inspect(name);
    await expect(
      panel.locator('.wiki-tooltip-fact').filter({ hasText: "Kalla's Fervor:" }).locator('img')
    ).toHaveAttribute('src', 'https://render.guildwars2.com/file/4DDE151C71EDB6120E3454036C4C3504EADB02D8/1770161.png');
  }
});

// Blight alternatives remain exclusive, keyboard-accessible, and reset when inspecting another skill.
test('Harbinger effect tabs switch payloads while retaining shared costs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
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

// Changing the actual build must refresh the core trait's specialization-dependent facts.
test('Dhuumfire cards follow the selected elite specialization', async ({ page }) => {
  await page.goto('/necromancer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const [specialization, duration, cooldown] of [
    ['Harbinger', '1s', false],
    ['Scourge', '2s', true],
    ['Reaper', '3s', false]
  ]) {
    await page.evaluate((specialization) => {
      const app = window.necromancerApp;
      app.build.specializations = [
        { name: 'Soul Reaping', traits: '1-1-1' },
        { name: 'Curses', traits: '1-1-1' },
        { name: specialization, traits: '1-1-1' }
      ];
      app.changed();
    }, specialization);
    await page.getByRole('button', { name: 'Dhuumfire', exact: true }).hover();
    const panel = page.locator('#wiki-tooltip');
    await expect(panel).toContainText(`Burning: ${duration}`);
    if (cooldown) await expect(panel).toContainText('Internal cooldown: 1s');
    else await expect(panel).not.toContainText('Internal cooldown');
  }
});

// Actual production adapters bind selected declarations to trait cards without API fact rows.
test('Necromancer cards use simulation bonuses and condition durations', async ({ page }) => {
  await page.evaluate(async () => {
    const { traitTooltipAttributes } = await import('/js/games/gw2/app/shared/tooltip-overlay.ts');
    const { loadProfessionAppAdapter } = await import('/js/games/gw2/app/profession-registry.ts');
    const adapter = await loadProfessionAppAdapter('necromancer');
    for (const name of [
      'Death Perception',
      'Deathly Haste',
      'Septic Corruption',
      'Soul Eater',
      "Reaper's Onslaught",
      'Sinister Shroud',
      'Spiteful Fortitude',
      'Cascading Corruption'
    ]) {
      const trait = adapter.profession.catalog.traits.find((entity) => entity.name === name);
      const wrapper = document.createElement('div');
      wrapper.innerHTML =
        '<button id="check-' +
        trait.id +
        '" ' +
        traitTooltipAttributes(trait, adapter.traitTooltip(trait, undefined, 'Core')) +
        '>' +
        name +
        '</button>';
      document.body.append(wrapper);
    }
  });
  const panel = page.locator('#wiki-tooltip');
  await page.locator('#check-893').hover();
  await expect(panel).toContainText('Critical chance: +15%');
  await expect(panel).toContainText('Critical damage while in shroud: +10%');
  await page.locator('#check-2194').hover();
  await expect(panel).toContainText('Quickness: 4s');
  await expect(panel).toContainText('Fury: 4s');
  await page.locator('#check-2185').hover();
  await expect(panel).toContainText('Poisoned: 3s');
  await expect(panel).toContainText('Condition damage per blight: +0.25%');
  // Qualified row labels retain their underlying damage, attribute, and recharge icons.
  await page.getByRole('button', { name: 'Soul Eater', exact: true }).hover();
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Strike damage near target' }).locator('img')
  ).toHaveAttribute('src', /61AA4919C4A7990903241B680A69530121E994C7\/156657\.png$/);
  await page.getByRole('button', { name: "Reaper's Onslaught", exact: true }).hover();
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Ferocity in shroud' }).locator('img')
  ).toHaveAttribute('src', /0658D833944E69E62E08EB18A0B5407F722125BC\/2229320\.png$/);
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Recharge reduction' }).locator('img')
  ).toHaveAttribute('src', /D767B963D120F077C3B163A05DC05A7317D7DB70\/156651\.png$/);
  await page.getByRole('button', { name: 'Sinister Shroud', exact: true }).hover();
  await expect(panel).toContainText('Shroud and shade recharge reduction: +15%');
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Shroud and shade recharge reduction' }).locator('img')
  ).toHaveAttribute('src', /D767B963D120F077C3B163A05DC05A7317D7DB70\/156651\.png$/);
  await page.getByRole('button', { name: 'Spiteful Fortitude', exact: true }).hover();
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Life force gained' }).locator('img')
  ).toHaveAttribute('src', /9352ED3244417304995F26CB01AE76BB7E547052\/156661\.png$/);
  await page.getByRole('button', { name: 'Cascading Corruption', exact: true }).hover();
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Blight consumed per trigger' }).locator('img')
  ).toHaveAttribute('src', /6B797B70EF545937F677BCD463BD23DC749B0801\/2479350\.png$/);
  await expect(panel.getByRole('img', { name: '1 stack of Meltdown', exact: true }).locator('img')).toHaveAttribute(
    'src',
    /03291423C8D1BE039F100726B40BC218F021EFEF\/3790487\.png$/
  );
  await expect(
    panel.locator('.wiki-tooltip-fact').filter({ hasText: 'Damage during Meltdown' }).locator('img')
  ).toHaveAttribute('src', /61AA4919C4A7990903241B680A69530121E994C7\/156657\.png$/);
});
