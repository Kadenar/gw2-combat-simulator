import { expect, test } from '@playwright/test';

// Mount chart fixtures without application startup so these tests exercise only native chart interactions.
test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4173/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
  );
  await page.goto('/');
  await page.addStyleTag({ url: '/css/style.css' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountCharts(page);
});

async function mountCharts(page) {
  await page.evaluate(async () => {
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    if (!document.querySelector('#charts'))
      document.body.innerHTML = '<main style="max-width:1000px;margin:auto"><div id="charts"></div></main>';
    const cumulativeDamage = Array.from({ length: 81 }, (_, index) => ({ t: index * 250, v: index * index * 100 }));
    mountTimeSeriesCharts(
      document.querySelector('#charts'),
      {
        durationMs: 20000,
        cumulativeDamage,
        damageContributions: {
          strike: cumulativeDamage.map(({ t, v }) => ({ t, v: v * 0.6 })),
          condition: cumulativeDamage.map(({ t, v }) => ({ t, v: v * 0.4 }))
        },
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
}

// Control the browser clock to check real canvas reveals and keep inspection stable while frames advance.
test('visible charts reveal once and respect motion changes and replacement mounts', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2000 });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  const pixels = () =>
    page.locator('.chart-canvas').evaluateAll(async (canvases) =>
      Promise.all(
        canvases.map(async (canvas) => {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canvas.toDataURL()));
          return Array.from(new Uint8Array(digest)).join(',');
        })
      )
    );
  const complete = await pixels();
  expect(complete).toHaveLength(3);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountCharts(page);
  await waitForVisibleChart(page, 'conditions');
  const initial = await pixels();
  await page.clock.runFor(200);
  const partial = await pixels();
  for (let index = 0; index < 3; index++) {
    expect(partial[index]).not.toBe(initial[index]);
    expect(partial[index]).not.toBe(complete[index]);
  }

  // Keyboard inspection also avoids dependence on the fixture's position within the page.
  await page.locator('[data-role="dps-canvas"]').dispatchEvent('keydown', { key: 'ArrowRight' });
  await expect(page.locator('[data-role="dps-tooltip"]')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('[data-role="dps-tooltip"]')).toBeVisible();
  expect(await pixels()).toEqual(complete);
  await page.locator('[data-dps-source="strike"]').evaluate((input) => {
    input.click();
    input.click();
  });
  expect(await pixels()).toEqual(complete);
  await page.clock.runFor(1000);
  expect(await pixels()).toEqual(complete);

  await mountCharts(page);
  await waitForVisibleChart(page, 'conditions');
  await page.clock.runFor(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(pixels).toEqual(complete);
  await mountCharts(page);
  expect(await pixels()).toEqual(complete);
  await page.clock.runFor(1200);
  expect(await pixels()).toEqual(complete);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountCharts(page);
  await waitForVisibleChart(page, 'conditions');
  await page.clock.runFor(200);
  await mountCharts(page);
  await waitForVisibleChart(page, 'conditions');
  expect(await pixels()).toEqual(initial);
  await page.clock.runFor(1200);
  expect(await pixels()).toEqual(complete);
});

// Intersection delivery is native even with a paused animation clock; wait for visibility before advancing frames.
async function waitForVisibleChart(page, kind) {
  await page.locator(`[data-role="${kind}-canvas"]`).evaluate(
    (canvas) =>
      new Promise((resolve) => {
        const observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.2)) return;
            observer.disconnect();
            resolve();
          },
          { threshold: 0.2 }
        );
        observer.observe(canvas);
      })
  );
}

// Scrolling to one panel must not spend another panel's reveal while it remains below the fold.
test('offscreen charts wait for their own viewport entry and never replay on return', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.addStyleTag({ content: 'main { padding-top: 1400px; } .chart-panel { margin-bottom: 700px; }' });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  const pixels = () =>
    page.locator('.chart-canvas').evaluateAll((canvases) => canvases.map((canvas) => canvas.toDataURL()));
  const complete = await pixels();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountCharts(page);
  const initial = await pixels();
  await page.clock.runFor(2000);
  expect(await pixels()).toEqual(initial);
  // Resizing before scrolling must preserve every pending entrance.
  await page.setViewportSize({ width: 1000, height: 650 });
  await page.clock.runFor(32);
  const resized = await pixels();
  await page.clock.runFor(2000);
  expect(await pixels()).toEqual(resized);
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.clock.runFor(32);
  expect(await pixels()).toEqual(initial);
  for (const [index, kind] of ['dps', 'effects', 'conditions'].entries()) {
    await page.locator(`[data-role="${kind}-canvas"]`).evaluate((canvas) => canvas.scrollIntoView({ block: 'center' }));
    await waitForVisibleChart(page, kind);
    await page.clock.runFor(200);
    const partial = await pixels();
    expect(partial[index]).not.toBe(initial[index]);
    expect(partial[index]).not.toBe(complete[index]);
    expect(partial.slice(index + 1)).toEqual(initial.slice(index + 1));
    await page.clock.runFor(1000);
    expect((await pixels())[index]).toBe(complete[index]);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.clock.runFor(100);
  await page.locator('[data-role="dps-canvas"]').evaluate((canvas) => canvas.scrollIntoView({ block: 'center' }));
  await waitForVisibleChart(page, 'dps');
  await page.clock.runFor(200);
  expect(await pixels()).toEqual(complete);
  await page.evaluate(() => window.scrollTo(0, 0));
  await mountCharts(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(pixels).toEqual(complete);
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

// Independent controls compose across source, averaging window, phase, and zoom selections.
test('DPS checkboxes select arbitrary sources and windows without changing other selections', async ({ page }) => {
  const sources = page.getByRole('group', { name: 'Damage sources' });
  const windows = page.getByRole('group', { name: 'DPS averaging' });
  const tooltip = page.locator('[data-role="dps-tooltip"]');
  await sources.getByRole('checkbox', { name: 'Total', exact: true }).uncheck();
  await sources.getByRole('checkbox', { name: 'Strike', exact: true }).check();
  await sources.getByRole('checkbox', { name: 'Condition', exact: true }).check();
  await windows.getByRole('checkbox', { name: 'Last 1s', exact: true }).check();
  await hoverChart(page, 'dps');
  await expect(tooltip).toContainText('Average so far Strike DPS');
  await expect(tooltip).toContainText('Last 1s Condition DPS');
  await expect(tooltip).not.toContainText('Total DPS');
  await expect(tooltip).not.toContainText('Last 5s');
  await windows.getByRole('checkbox', { name: 'Average so far', exact: true }).uncheck();
  await windows.getByRole('checkbox', { name: 'Last 5s', exact: true }).check();
  await sources.getByRole('checkbox', { name: 'Condition', exact: true }).uncheck();
  await hoverChart(page, 'dps');
  await expect(tooltip).toContainText('Last 1s Strike DPS');
  await expect(tooltip).toContainText('Last 5s Strike DPS');
  await expect(tooltip).not.toContainText('Condition');
  await expect(tooltip).not.toContainText('Average so far');
  await dragChart(page, 'dps', 0.2, 0.8);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(windows.getByRole('checkbox', { name: 'Last 1s', exact: true })).toBeChecked();
  await expect(windows.getByRole('checkbox', { name: 'Last 5s', exact: true })).toBeChecked();
  await expect(sources.getByRole('checkbox', { name: 'Condition', exact: true })).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await sources.getByRole('checkbox', { name: 'Strike', exact: true }).uncheck();
  await sources.getByRole('checkbox', { name: 'Total', exact: true }).check();
  await hoverChart(page, 'dps');
  await expect(tooltip).toContainText('Last 1s Total DPS');
  await expect(tooltip).not.toContainText('Strike');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('DPS averaging and condition controls stay independent with a synchronized cursor', async ({ page }) => {
  const windows = page.getByRole('group', { name: 'DPS averaging' });
  const dps = page.locator('[data-role="dps-tooltip"]');
  await hoverChart(page, 'dps');
  await expect(dps).toContainText('Average so far Total DPS');
  await expect(dps).not.toContainText('Last');
  await windows.getByRole('checkbox', { name: 'Last 1s', exact: true }).check();
  await windows.getByRole('checkbox', { name: 'Last 5s', exact: true }).check();
  await hoverChart(page, 'conditions');
  await expect(dps).toContainText('Average so far Total DPS');
  await expect(dps).toContainText('Last 1s Total DPS');
  await expect(dps).toContainText('Last 5s Total DPS');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Might (Self)');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Empowered');
  await expect(page.locator('[data-role="effects-tooltip"]')).not.toContainText('Burning');
  await expect(page.locator('[data-role="conditions-tooltip"]')).toContainText('Burning');
  const times = await page.locator('.chart-crosshair').evaluateAll((nodes) => nodes.map((node) => node.dataset.time));
  expect(new Set(times).size).toBe(1);
  await expect(page.locator('.chart-crosshair:visible')).toHaveCount(3);
  await page.locator('[data-effect-type="condition"]').getByRole('button', { name: 'None', exact: true }).click();
  await hoverChart(page, 'effects');
  await expect(page.locator('[data-role="conditions-tooltip"]')).toContainText('No visible effects');
  await expect(page.locator('[data-role="effects-tooltip"]')).toContainText('Might (Self)');
});

test('dragging either direction zooms all charts and preserves DPS values, modes, and selections', async ({ page }) => {
  await page.locator('[data-dps-window="rolling-1s"]').check();
  await page.locator('[data-dps-window="rolling-5s"]').check();
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
  await expect(page.locator('[data-dps-window="rolling-1s"]')).toBeChecked();
  await expect(page.locator('[data-dps-window="rolling-5s"]')).toBeChecked();
  const firstRange = await page.locator('[data-role="chart-zoom-label"]').innerText();
  await dragChart(page, 'effects', 0.8, 0.2);
  await expect(page.locator('[data-role="chart-zoom-label"]')).not.toHaveText(firstRange);
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  await dragChart(page, 'dps', 0.2, 0.8);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  await expect(page.locator('[data-role="conditions-panel-title"]')).toContainText('100-80%');
  await expect(page.locator('[data-dps-window="rolling-1s"]')).toBeChecked();
  await expect(page.locator('[data-dps-window="rolling-5s"]')).toBeChecked();
});

// Native double-clicks reset the linked viewport while preserving the selected phase and chart controls.
test('double-clicking any chart resets active zoom to the current phase', async ({ page }) => {
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(page.locator('[data-role="dps-panel-title"]')).toContainText('100-80%');
  await page.locator('[data-dps-window="rolling-1s"]').check();
  await page.locator('[data-dps-source="strike"]').check();
  const reset = page.getByRole('button', { name: 'Reset zoom' });
  const range = page.locator('[data-role="chart-zoom-label"]');
  const initialRange = await range.innerText();
  for (const kind of ['dps', 'effects', 'conditions']) {
    const canvas = page.locator(`[data-role="${kind}-canvas"]`);
    await dragChart(page, kind, 0.2, 0.8);
    await expect(reset).toBeEnabled();
    await canvas.click({ position: { x: 100, y: 100 } });
    await expect(reset).toBeEnabled();
    await canvas.dblclick({ position: { x: 100, y: 100 } });
    await expect(reset).toBeDisabled();
    await expect(range).toHaveText(initialRange);
    await expect(page.locator('.chart-selection:visible')).toHaveCount(0);
    await expect(page.locator('[data-chart-phase="100-80"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-dps-window="rolling-1s"]')).toBeChecked();
    await expect(page.locator('[data-dps-source="strike"]')).toBeChecked();
    await canvas.dblclick({ position: { x: 100, y: 100 } });
    await expect(range).toHaveText(initialRange);
  }
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
