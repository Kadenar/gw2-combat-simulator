import { expect, test } from '@playwright/test';

test.describe('touch equipment pickers', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  // Touch users can browse both choices without opening a keyboard until they tap Search.
  test('weapon configuration waits for a search tap and preserves keyboard access', async ({ page }) => {
    const launcher = page.locator('.weapon-icon-trigger').first();
    const editor = page.locator('#weapon-editor-1-0');
    await launcher.tap();
    await expect(editor).toBeVisible();
    await expect(editor.locator('input[name="weapon"]:checked')).toBeFocused();
    const search = editor.getByRole('searchbox', { name: 'Search stats' });
    await expect(search).toBeVisible();
    await expect(search).not.toBeFocused();
    await search.tap();
    await expect(search).toBeFocused();
    await search.fill('zzzzzz');
    await expect(editor.getByRole('status')).toHaveText('No matching choices');
    await search.press('Escape');
    await expect(editor).toBeHidden();
    await expect(launcher).toBeFocused();
    await launcher.press('Enter');
    await expect(search).toHaveValue('');
    await search.fill('viper');
    await search.press('ArrowDown');
    await expect(editor.locator('input[name="weapon-prefix"][value="Viper\'s"]')).toBeFocused();
    await page.keyboard.press('Space');
    await editor.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(launcher).toBeFocused();
    expect(await page.evaluate(() => window.professionApp.build.gear.Weapon1)).toBe("Viper's");
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto('/elementalist.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
});

// Escape discards a weapon draft and returns focus to its launcher; reopening starts from equipped values.
test('Escape cancels the weapon editor and restores focus', async ({ page }) => {
  const launcher = page.locator('.weapon-icon-trigger').first();
  const editor = page.locator('#weapon-editor-1-0');
  const before = await page.evaluate(() => ({
    weapons: window.professionApp.build.weapons,
    prefix: window.professionApp.build.gear.Weapon1
  }));
  await launcher.click();
  await editor.locator('input[name="weapon"]:not(:checked)').last().check();
  const search = editor.getByRole('searchbox', { name: 'Search stats' });
  await search.fill('viper');
  await search.press('Enter');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(launcher).toBeFocused();
  expect(
    await page.evaluate(() => ({
      weapons: window.professionApp.build.weapons,
      prefix: window.professionApp.build.gear.Weapon1
    }))
  ).toEqual(before);
  await launcher.click();
  await expect(editor.locator('input[name="weapon"]:checked')).toHaveValue(before.weapons[0]);
  await expect(editor.locator('input[name="weapon-prefix"]:checked')).toHaveValue(before.prefix);
  await editor.getByRole('button', { name: 'Close editor' }).click();
  await expect(launcher).toBeFocused();
});

// Opening must finish positioning before a paint, including after the viewport changes.
test('equipment dropdowns are positioned synchronously on every open', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of ['.gear-prefix[data-slot="Helm"]', '#sel-rune', '#sel-food']) {
      const geometry = await page.locator(selector).evaluate((select) => {
        const trigger = select.parentElement.querySelector('.gear-select-trigger');
        trigger.focus();
        trigger.click();
        const menu = select.parentElement.querySelector('.gear-select-menu');
        const anchor = trigger.getBoundingClientRect();
        const bounds = menu.getBoundingClientRect();
        const result = {
          left: bounds.left,
          top: bounds.top,
          expectedLeft: Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8)),
          expectedTop:
            anchor.bottom + bounds.height + 2 <= innerHeight
              ? anchor.bottom + 2
              : Math.max(8, anchor.top - bounds.height - 2)
        };
        menu.hidePopover();
        return result;
      });
      expect(geometry.left).toBeCloseTo(geometry.expectedLeft, 1);
      expect(geometry.top).toBeCloseTo(geometry.expectedTop, 1);
    }
  }
});

// Search keeps focus in the input and leaves gear unchanged until a filtered result is committed.
test('equipment dropdowns support search, cancellation, and keyboard selection', async ({ page }) => {
  const display = page.locator('.gear-select-display').filter({ has: page.locator('.gear-prefix[data-slot="Helm"]') });
  const trigger = display.locator('.gear-select-trigger');
  const select = display.locator('select');
  const menu = display.getByRole('listbox');
  const search = display.getByRole('searchbox');
  const choice = (value) => menu.locator(`[data-value="${value}"]`);
  const initial = await select.inputValue();
  await trigger.click();
  await page.keyboard.type('ri');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('ri');
  await expect(choice("Ritualist's")).toBeVisible();
  await expect(choice("Berserker's")).toBeHidden();
  await expect(select).toHaveValue(initial);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.type('vip');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('vip');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await expect(choice("Viper's")).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(select).toHaveValue("Viper's");
  await expect(trigger.locator('img')).toHaveCount(1);
  await expect(display.locator('..').locator('.gear-equipped-name')).toHaveText("Viper's");
  expect(await page.evaluate(() => window.professionApp.build.gear.Helm)).toBe("Viper's");

  await trigger.click();
  await expect(search).toHaveValue('');
  await search.fill('r');
  await search.press('ArrowDown');
  await expect(menu.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(select).toHaveValue("Viper's");
});
