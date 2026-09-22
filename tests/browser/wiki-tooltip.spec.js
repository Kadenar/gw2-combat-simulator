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

// Base effect rows aggregate identical applications and keep coefficients distinct from final damage predictions.
test('skill cards show damage and conditions without targeting trivia', async ({ page }) => {
  await page.evaluate(async () => {
    const { skillTooltipAttributes } = await import('/js/games/gw2/app/shared/wiki-tooltip.ts');
    document.body.insertAdjacentHTML(
      'beforeend',
      `<button id="effect-tooltip-check" ${skillTooltipAttributes({
        id: 'tooltip-check',
        name: 'Example Signet',
        description: 'Signet Passive: Improves critical chance.\nSignet Active: Burn your foe.',
        cooldown: 12,
        range: 1200,
        radius: 240,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 0, coefficient: 0.2 },
              { atMs: 100, coefficient: 0.3 }
            ]
          },
          { type: 'condition', condition: 'Burning', stacks: 2, duration: 10, applications: 2 },
          { type: 'boon', boon: 'Might', stacks: 3, duration: 6 }
        ]
      })}>Inspect example</button>`
    );
  });
  await page.locator('#effect-tooltip-check').hover();
  const panel = page.locator('#wiki-tooltip');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Strike damage: 0.5 coefficient · 2 hits');
  await expect(panel).toContainText('Burning: 2 stacks · 10s × 2 applications');
  await expect(panel).toContainText('Might: 3 stacks · 6s');
  await expect(panel.locator('.wiki-tooltip-highlight')).toHaveText(['Signet Passive:', 'Signet Active:']);
  await expect(panel.locator('.wiki-tooltip-recharge')).toHaveAttribute('aria-label', 'Recharge: 12 seconds');
  await expect(panel).not.toContainText(/Range|Radius|Number of Targets/);
  await panel.screenshot({ path: test.info().outputPath('skill-tooltip.png') });
});
