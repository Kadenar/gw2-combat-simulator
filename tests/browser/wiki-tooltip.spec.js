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
