import { expect, test } from '@playwright/test';

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

// Type-ahead moves focus without changing gear until committed, and repeats cycle matching names.
test('equipment dropdowns support typed prefixes, cycling, cancellation, and keyboard selection', async ({ page }) => {
  const display = page.locator('.gear-select-display').filter({ has: page.locator('.gear-prefix[data-slot="Helm"]') });
  const trigger = display.locator('.gear-select-trigger');
  const select = display.locator('select');
  const menu = display.getByRole('listbox');
  const choice = (value) => menu.locator(`[data-value="${value}"]`);
  const initial = await select.inputValue();
  await trigger.click();
  await page.keyboard.type('ri');
  await expect(choice("Ritualist's")).toBeFocused();
  await expect(select).toHaveValue(initial);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.type('vip');
  await expect(choice("Viper's")).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(select).toHaveValue("Viper's");
  expect(await page.evaluate(() => window.professionApp.build.gear.Helm)).toBe("Viper's");

  await trigger.click();
  await page.keyboard.press('r');
  await expect(choice('Rabid')).toBeFocused();
  await page.keyboard.press('r');
  await expect(choice("Rampager's")).toBeFocused();
  await page.keyboard.press('r');
  await expect(choice("Ritualist's")).toBeFocused();
  await page.keyboard.press('r');
  await expect(choice('Rabid')).toBeFocused();
  await page.waitForTimeout(750);
  await page.keyboard.type('cel');
  await expect(choice('Celestial')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(select).toHaveValue("Viper's");
});
