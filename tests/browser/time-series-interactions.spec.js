import { expect, test } from '@playwright/test';

// Mount chart fixtures without application startup so these tests exercise only native chart interactions.
test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4173/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
  );
  await page.goto('/');
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    document.body.innerHTML = '<main style="max-width:1000px;margin:auto"><div id="charts"></div></main>';
    const cumulativeDamage = Array.from({ length: 81 }, (_, index) => ({ t: index * 250, v: index * index * 100 }));
    mountTimeSeriesCharts(
      document.querySelector('#charts'),
      {
        durationMs: 20000,
        cumulativeDamage,
        dps: cumulativeDamage.map(({ t, v }) => ({ t, v: t ? v / (t / 1000) : 0 })),
        effects: {
          Might: [
            { t: 0, v: 25 },
            { t: 20000, v: 25 }
          ],
          Burning: [
            { t: 0, v: 8 },
            { t: 20000, v: 8 }
          ],
          Empowered: [
            { t: 0, v: 1 },
            { t: 20000, v: 1 }
          ]
        },
        effectTypes: { Might: 'boon', Burning: 'condition', Empowered: 'buff' }
      },
      { healthBreakpoints: [{ healthPercent: 80, elapsed: 10, damage: 160000 }] }
    );
  });
});

async function hoverChart(page, kind, ratio = 0.5) {
  const canvas = page.locator(`[data-role="${kind}-canvas"]`);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await canvas.hover({ position: { x: 54 + (box.width - 70) * ratio, y: 100 } });
}

async function dragChart(page, kind, from, to) {
  const canvas = page.locator(`[data-role="${kind}-canvas"]`);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 54 + (box.width - 70) * from, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 54 + (box.width - 70) * to, box.y + 100, { steps: 5 });
  await expect(page.locator('.chart-selection:visible')).toHaveCount(3);
  await page.mouse.up();
}

test('DPS display and condition controls stay independent with a synchronized cursor', async ({ page }) => {
  const display = page.getByRole('group', { name: 'DPS display' });
  const dps = page.locator('[data-role="dps-tooltip"]');
  await hoverChart(page, 'dps');
  await expect(dps).toContainText('Cumulative DPS');
  await expect(dps).not.toContainText('Rolling');
  await display.getByRole('button', { name: 'Rolling 1s', exact: true }).click();
  await hoverChart(page, 'dps');
  await expect(dps).toContainText('Rolling 1s DPS');
  await expect(dps).not.toContainText('Cumulative');
  await expect(dps).not.toContainText('Rolling 5s');
  await display.getByRole('button', { name: 'Rolling 5s', exact: true }).click();
  await hoverChart(page, 'dps');
  await expect(dps).toContainText('Rolling 5s DPS');
  await expect(dps).not.toContainText('Cumulative');
  await expect(dps).not.toContainText('Rolling 1s');
  await display.getByRole('button', { name: 'All', exact: true }).click();
  await hoverChart(page, 'conditions');
  await expect(dps).toContainText('Cumulative DPS');
  await expect(dps).toContainText('Rolling 1s DPS');
  await expect(dps).toContainText('Rolling 5s DPS');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Might (Self)');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Empowered');
  await expect(page.locator('[data-role="effects-tooltip"]')).not.toContainText('Burning');
  await expect(page.locator('[data-role="conditions-tooltip"]')).toContainText('Burning');
  await expect(page.locator('[data-role="conditions-tooltip"]')).not.toContainText('Might');
  const times = await page.locator('.chart-crosshair').evaluateAll((nodes) => nodes.map((node) => node.dataset.time));
  expect(new Set(times).size).toBe(1);
  await expect(page.locator('.chart-crosshair:visible')).toHaveCount(3);
  await page.locator('[data-effect-type="condition"]').getByRole('button', { name: 'None', exact: true }).click();
  await hoverChart(page, 'effects');
  await expect(page.locator('[data-role="conditions-tooltip"]')).toContainText('No visible effects');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Might (Self)');
});

test('dragging either direction zooms all charts and preserves DPS values, modes, and selections', async ({ page }) => {
  await page.getByRole('group', { name: 'DPS display' }).getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('[data-series="Empowered"]').uncheck();
  const dps = page.locator('[data-role="dps-tooltip"]');
  await hoverChart(page, 'dps');
  const originalValues = (await dps.innerText()).split('\n').slice(1);
  await dragChart(page, 'conditions', 0.25, 0.75);
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
  await expect(page.locator('[data-role="chart-zoom-label"]')).toContainText('Zoom:');
  await hoverChart(page, 'effects');
  expect((await dps.innerText()).split('\n').slice(1)).toEqual(originalValues);
  await expect(page.locator('[data-series="Empowered"]')).not.toBeChecked();
  await expect(page.locator('[data-dps-mode="all"]')).toHaveAttribute('aria-pressed', 'true');
  const firstRange = await page.locator('[data-role="chart-zoom-label"]').innerText();
  await dragChart(page, 'effects', 0.8, 0.2);
  await expect(page.locator('[data-role="chart-zoom-label"]')).not.toHaveText(firstRange);
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  await dragChart(page, 'dps', 0.2, 0.8);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  await expect(page.locator('[data-role="conditions-panel-title"]')).toContainText('100-80%');
  await expect(page.locator('[data-dps-mode="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard inspection, cancellation, and zoom work after resizing to mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = page.locator('[data-role="conditions-canvas"]');
  await canvas.focus();
  await canvas.press('ArrowRight');
  await expect(page.locator('.chart-crosshair:visible')).toHaveCount(3);
  await canvas.press('+');
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
  await canvas.press('Escape');
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  await dragChart(page, 'conditions', 0.2, 0.8);
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
  await canvas.press('Escape');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 90, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 100);
  await canvas.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.chart-selection:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Compare live canvas output to verify legend hover/focus changes rendering without changing visibility or other panels.
test('effect legends highlight on hover and keyboard focus and restore on leaving', async ({ page }) => {
  const effects = page.locator('[data-role="effects-canvas"]');
  const conditions = page.locator('[data-role="conditions-canvas"]');
  const dps = page.locator('[data-role="dps-canvas"]');
  const pixels = (canvas) => canvas.evaluate((element) => element.toDataURL());
  const might = page.locator('[data-series="Might"]');
  const label = might.locator('..');
  const neutral = page.locator('[data-role="effects-panel-title"]');
  await neutral.hover();
  const original = await pixels(effects);
  const originalConditions = await pixels(conditions);
  const originalDps = await pixels(dps);
  await label.hover();
  expect(await pixels(effects)).not.toBe(original);
  expect(await pixels(conditions)).toBe(originalConditions);
  expect(await pixels(dps)).toBe(originalDps);
  await expect(might).toBeChecked();
  await neutral.hover();
  expect(await pixels(effects)).toBe(original);
  await page.locator('[data-effect-type="boon"] [data-toggle-action="none"]').focus();
  await page.keyboard.press('Tab');
  await expect(might).toBeFocused();
  expect(await pixels(effects)).not.toBe(original);
  await might.press('Tab');
  await neutral.hover();
  await effects.focus();
  expect(await pixels(effects)).toBe(original);
  await might.uncheck();
  await effects.focus();
  await neutral.hover();
  const unchecked = await pixels(effects);
  await label.hover();
  expect(await pixels(effects)).toBe(unchecked);
  await expect(might).not.toBeChecked();
  await page.locator('[data-series="Burning"]').locator('..').hover();
  expect(await pixels(conditions)).not.toBe(originalConditions);
  expect(await pixels(effects)).toBe(unchecked);
  await neutral.hover();
  expect(await pixels(conditions)).toBe(originalConditions);
});

// Clicking a label leaves native checkbox focus behind, but that focus must not pin mouse highlighting.
test('legend highlights clear after clicking and leaving a focused checkbox', async ({ page }) => {
  const effects = page.locator('[data-role="effects-canvas"]');
  const pixels = () => effects.evaluate((element) => element.toDataURL());
  const might = page.locator('[data-series="Might"]');
  const label = might.locator('..');
  const neutral = page.locator('[data-role="effects-panel-title"]');
  await neutral.hover();
  const original = await pixels();
  await might.uncheck();
  await label.click();
  await expect(might).toBeChecked();
  await neutral.hover();
  await expect(might).toBeFocused();
  expect(await pixels()).toBe(original);
  // Switching back to the keyboard on the same checkbox still enables inspection.
  await might.press('Space');
  await might.press('Space');
  expect(await pixels()).not.toBe(original);
  // A later pointer click must clear keyboard highlighting even without a new focus event.
  await might.click();
  await might.click();
  await neutral.hover();
  expect(await pixels()).toBe(original);
});
