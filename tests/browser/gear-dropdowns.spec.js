import { expect, test } from '@playwright/test';

test.describe('touch equipment pickers', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  // Opening and dismissing touch pickers must never focus native selects or search until explicitly requested.
  test('weapon configuration waits for a search tap and preserves keyboard access', async ({ page }) => {
    const launcher = page.locator('.weapon-icon-trigger').first();
    const editor = page.locator('#weapon-editor-1-0');
    const weapon = page.locator('#sel-mh1').locator('..').locator('.gear-select-trigger');
    await launcher.tap();
    await expect(editor).toBeVisible();
    await expect(weapon).toBeFocused();
    for (const id of ['sel-mh1', 'sel-stat1-1']) {
      const display = page.locator(`#${id}`).locator('..');
      const trigger = display.locator('.gear-select-trigger');
      const search = display.getByRole('searchbox');
      await trigger.tap();
      await expect(search).toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.tap();
      await expect(search).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.tap();
      await search.tap();
      await expect(search).toBeFocused();
      await search.fill('zzzzzz');
      await expect(display.getByRole('status')).toHaveText('No matching choices');
      await search.press('Escape');
      await expect(trigger).toBeFocused();
      await trigger.press('Enter');
      await expect(search).toBeFocused();
      await expect(search).toHaveValue('');
      await search.press('Escape');
    }

    await editor.getByRole('button', { name: 'Close weapon picker' }).tap();
    await expect(editor).toBeHidden();
    await expect(launcher).toBeFocused();
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto('/elementalist.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
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
