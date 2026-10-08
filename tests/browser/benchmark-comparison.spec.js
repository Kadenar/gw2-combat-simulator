import { expect, test } from '@playwright/test';

async function openComparison(page) {
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(page.locator('[data-bc-search]')).toBeVisible();
}

async function pickFirst(page, profession) {
  await page.locator('[data-bc-profession]').selectOption(profession);
  await page.locator('[data-bc-pick]:enabled').first().click();
}

// Native checkboxes must reflect saved defaults and send only the edited simulation back through a worker.
test('allies toggle per selected simulation using its saved default and preserve other results', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.comparisonParties = [];
    const postMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      if (message.row)
        window.comparisonParties.push({ profession: message.row.profession, count: message.alliedPlayerCount });
      return postMessage.call(this, message, ...args);
    };
  });
  await page.route('**/data/gw2/builds/*/b-*.json*', async (route) => {
    const response = await route.fetch();
    const build = await response.json();
    build.assumptions = {
      ...build.assumptions,
      alliedPlayerCount: route.request().url().includes('/guardian/') ? 2 : 0
    };
    await route.fulfill({ response, json: build });
  });
  await openComparison(page);
  await pickFirst(page, 'guardian');
  await pickFirst(page, 'mesmer');
  const guardian = page.locator('[data-bc-allies]').nth(0);
  const mesmer = page.locator('[data-bc-allies]').nth(1);
  await expect(guardian).toBeEnabled();
  await expect(guardian).toBeChecked();
  await expect(guardian.locator('..')).toContainText('(2)');
  await expect(mesmer).toBeEnabled();
  await expect(mesmer).not.toBeChecked();
  const run = async () => {
    await page.locator('[data-bc-run]').click();
    await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
  };

  await run();
  const retained = await page.locator('[data-bc-final]').nth(1).textContent();
  await guardian.focus();
  await guardian.press('Space');
  await expect(guardian).not.toBeChecked();
  await expect(guardian).toBeFocused();
  await expect(mesmer).not.toBeChecked();
  await expect(page.locator('[data-bc-run]')).toHaveText('Run comparison (1)');
  await expect(page.locator('[data-bc-final]').nth(1)).toHaveText(retained);
  await run();
  await mesmer.check();
  await expect(guardian).not.toBeChecked();
  await expect(mesmer.locator('..')).toContainText('(4)');
  await run();
  await guardian.check();
  await expect(guardian.locator('..')).toContainText('(2)');
  await run();
  expect(await page.evaluate(() => window.comparisonParties)).toEqual([
    { profession: 'guardian', count: null },
    { profession: 'mesmer', count: null },
    { profession: 'guardian', count: 0 },
    { profession: 'mesmer', count: 4 },
    { profession: 'guardian', count: null }
  ]);
  await page.locator('[data-bc-search]').fill('no matching builds');
  await expect(guardian).toBeChecked();
  await expect(mesmer).toBeChecked();
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(mesmer).toBeChecked();
  await page.setViewportSize({ width: 320, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed saved ally settings can be retried without guessing the checkbox default', async ({ page }) => {
  await openComparison(page);
  const builds = '**/data/gw2/builds/guardian/b-*.json*';
  await page.route(builds, (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await pickFirst(page, 'guardian');
  await expect(page.locator('[data-bc-allies]')).toBeDisabled();
  await expect(page.locator('[data-bc-parties]')).toContainText('unavailable');
  await page.unroute(builds);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('[data-bc-allies]')).toBeEnabled();
});

// Same-profession curves need stable, distinguishable identities across all of the linked controls.
test('same-profession comparisons retain distinct colors and line patterns while filtering and hiding builds', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openComparison(page);
  await page.locator('[data-bc-profession]').selectOption('elementalist');
  for (let index = 0; index < 3; index++) await page.locator('[data-bc-pick]:enabled').nth(index).click();
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
  const styles = () =>
    page.locator('[data-bc-legend] button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        color: button.style.getPropertyValue('--bc-color'),
        dash: button.querySelector('path').getAttribute('stroke-dasharray')
      }))
    );
  const initial = await styles();
  expect(new Set(initial.map(({ color }) => color)).size).toBe(3);
  expect(new Set(initial.map(({ dash }) => dash)).size).toBe(3);
  expect(
    await page
      .locator('[data-bc-readout] tr')
      .evaluateAll((rows) => rows.map((row) => row.style.getPropertyValue('--bc-color')))
  ).toEqual(initial.map(({ color }) => color));
  // Unequal run lengths must preserve final values while marking ended cursor values and the partial viewport.
  const canvas = page.locator('[data-bc-canvas]');
  const finalDps = await page.locator('[data-bc-final]').allTextContents();
  await expect(page.locator('[data-bc-partial]')).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width - 21, y: 100 } });
  const cursorValues = await page.locator('[data-bc-readout] .bc-value').allTextContents();
  expect(cursorValues.some((value) => /^Ended at \d+\.\d+s$/.test(value))).toBe(true);
  expect(cursorValues.some((value) => /^[\d,]+$/.test(value))).toBe(true);
  expect(await page.locator('[data-bc-final]').allTextContents()).toEqual(finalDps);
  await page.screenshot({ path: testInfo.outputPath('elementalist-comparison.png'), fullPage: true });
  await page.mouse.move(bounds.x + 90, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 200, bounds.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-bc-partial]')).toBeHidden();
  await page.locator('[data-bc-reset]').click();
  await expect(page.locator('[data-bc-partial]')).toBeVisible();
  await page.locator('[data-bc-search]').fill('no matching builds');
  await page.locator('[data-bc-legend] button').nth(1).click();
  await page.getByRole('button', { name: 'Last 5s', exact: true }).click();
  expect(await page.locator('[data-bc-final]').allTextContents()).toEqual(finalDps);
  expect(await styles()).toEqual(initial);
  await page.locator('[data-bc-search]').fill('');
  await page.locator('[data-bc-pick][aria-pressed="true"]').first().click();
  expect(await styles()).toEqual(initial.slice(1));
  await expect(page.locator('[data-bc-partial]')).toBeHidden();
});

// Native worker/module loading and chart interactions belong here; damage formulas are covered in Node.
test('comparison loads on demand, runs different professions, and keeps chart inspection local', async ({ page }) => {
  test.setTimeout(120_000);
  const requests = [];
  const errors = [];
  let workers = 0;
  page.on('request', (request) => requests.push(request.url()));
  page.on('worker', () => workers++);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  expect(requests.some((url) => url.includes('/benchmark-comparison/'))).toBe(false);
  expect(workers).toBe(0);
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(page.locator('[data-bc-search]')).toBeVisible();
  await expect(page.locator('[data-bc-run]')).toBeDisabled();
  await expect(page.locator('[data-bc-status]')).toBeHidden();
  await expect(page.locator('[data-bc-catalog] input[type="checkbox"]')).toHaveCount(0);
  await pickFirst(page, 'guardian');
  const firstBuild = page.locator('[data-bc-pick]:enabled').first();
  await expect(firstBuild).toHaveAttribute('aria-pressed', 'true');
  await firstBuild.press('Space');
  await expect(firstBuild).toHaveAttribute('aria-pressed', 'false');
  await firstBuild.press('Enter');
  await expect(firstBuild).toHaveAttribute('aria-pressed', 'true');
  await pickFirst(page, 'mesmer');
  // Selection loads saved ally defaults, while rotations and engines still wait for an explicit run.
  expect(requests.some((url) => /\/data\/gw2\/rotations\//.test(url))).toBe(false);
  expect(workers).toBe(0);
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
  expect(workers).toBe(2);
  await expect(page.locator('[data-bc-legend] button')).toHaveCount(2);
  await expect(page.locator('[data-bc-readout] tr')).toHaveCount(2);
  const canvas = page.locator('[data-bc-canvas]');
  await canvas.click({ position: { x: 250, y: 100 } });
  // Mouse inspection must not draw a focus ring; tab navigation must still identify the chart.
  await expect(canvas).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(canvas).toBeFocused();
  await expect(canvas).toHaveCSS('outline-style', 'solid');
  await canvas.click({ position: { x: 250, y: 100 } });
  await expect(canvas).toHaveCSS('outline-style', 'none');
  const before = await page.locator('[data-bc-readout]').textContent();
  await page.locator('[data-bc-canvas]').hover({ position: { x: 350, y: 100 } });
  await expect(page.locator('[data-bc-readout]')).toHaveText(before);
  await page.getByRole('button', { name: 'Last 1s', exact: true }).click();
  await expect(page.locator('[data-bc-title]')).toHaveText('1-second rolling DPS');
  expect(await page.locator('[data-bc-readout]').textContent()).not.toBe(before);
  await page.locator('[data-bc-legend] button').first().click();
  await expect(page.locator('[data-bc-legend] button').first()).toHaveAttribute('aria-pressed', 'false');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 90, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 260, bounds.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-bc-reset]')).toBeEnabled();
  await canvas.press('Escape');
  await expect(page.locator('[data-bc-reset]')).toBeDisabled();
  await expect(canvas).not.toBeFocused();
  // Inspection resumes after Escape, while keyboard inspection pins the readout against pointer movement.
  const readout = page.locator('[data-bc-readout]');
  const unpinned = await readout.textContent();
  await page.mouse.move(bounds.x + 350, bounds.y + 100);
  await expect(readout).not.toHaveText(unpinned);
  await canvas.press('ArrowRight');
  const pinned = await readout.textContent();
  await page.mouse.move(bounds.x + 450, bounds.y + 100);
  await expect(readout).toHaveText(pinned);
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(page.locator('[data-bc-readout] tr')).toHaveCount(2);
  expect(workers).toBe(2);
  for (const width of [1024, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await page.locator('[data-bc-clear]').click();
  await expect(page.locator('[data-bc-run]')).toBeDisabled();
  await expect(page.locator('[data-bc-empty-title]')).toHaveText('Choose your builds');
  expect(errors).toEqual([]);
});

test('failed assets show a per-build error and can be retried', async ({ page }) => {
  test.setTimeout(120_000);
  await openComparison(page);
  await pickFirst(page, 'guardian');
  const rotations = '**/data/gw2/rotations/guardian/*.json*';
  await page.route(rotations, (route) => route.fulfill({ status: 404, body: 'Missing rotation' }));
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-status]')).toContainText('failed', { timeout: 90_000 });
  await expect(page.locator('[data-bc-readout]')).toContainText('saved rotation is required');
  await page.unroute(rotations);
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
});

test('leaving comparison terminates preparation and a later run uses a fresh worker', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openComparison(page);
  await pickFirst(page, 'guardian');
  const loading = page.locator('[data-bc-loading]');
  await expect(loading).toBeHidden();
  await expect(page.locator('[data-bc-empty-title]')).toBeHidden();
  const plotBefore = await page.locator('.bc-plot').boundingBox();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let received;
  const started = new Promise((resolve) => {
    received = resolve;
  });
  let workers = 0;
  let activeWorker;
  page.on('worker', (worker) => {
    workers++;
    activeWorker = worker;
  });
  await page.route('**/data/gw2/rotations/guardian/*.json*', async (route) => {
    received();
    await gate;
    await route.continue();
  });
  await page.locator('[data-bc-run]').click();
  await started;
  await expect(page.locator('[data-bc-cancel]')).toBeVisible();
  await expect(page.locator('[data-bc-status]')).toBeHidden();
  expect((await page.locator('.bc-plot').boundingBox()).y).toBe(plotBefore.y);
  // Loading feedback follows the actual worker lifecycle and stays static for reduced-motion users.
  await expect(loading).toBeVisible();
  const curve = loading.locator('.bc-loading-curve').first();
  await expect(curve).toHaveCSS('animation-name', 'bc-loading-draw');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(curve).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: testInfo.outputPath('comparison-loading.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(workers).toBe(1);
  const closed = activeWorker.waitForEvent('close');
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await closed;
  release();
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(page.locator('[data-bc-status]')).toContainText('Run cancelled');
  await expect(page.locator('[data-bc-cancel]')).toBeHidden();
  await expect(loading).toBeHidden();
  expect(workers).toBe(1);
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
  await expect(loading).toBeHidden();
  expect(workers).toBe(2);
});

// Warm executions must reuse worker-local inputs, while profession code never loads on the page's UI thread.
test('repeated comparisons reuse workers and prepared preset assets', async ({ page }) => {
  test.setTimeout(120_000);
  let workers = 0;
  page.on('worker', () => workers++);
  const assets = [];
  page.on('request', (request) => {
    if (/\/data\/gw2\/(builds|rotations)\/[^/]+\/[br]-/.test(request.url())) assets.push(request.url());
  });
  await openComparison(page);
  await pickFirst(page, 'guardian');
  await pickFirst(page, 'mesmer');
  for (let run = 0; run < 2; run++) {
    await page.locator('[data-bc-run]').click();
    await expect(page.locator('[data-bc-run]')).toHaveText('Run again', { timeout: 90_000 });
    expect(workers).toBe(2);
    expect(assets).toHaveLength(4);
  }

  const imports = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(imports.filter((url) => /\/professions\/[^/]+\/(app\/app-definition|profession)\./.test(url))).toEqual([]);
});

// Control result delivery and the browser clock to verify reveals without depending on worker speed.
test('fresh results reveal once while cached visibility changes stay immediate', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.route('**/benchmark-comparison/execute.ts*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.comparisonJobs = [];
        export function createComparisonExecutor() {
          return {
            loadAlliedPlayerCount: async () => 0,
            execute: () => new Promise(resolve => window.comparisonJobs.push(resolve)),
            dispose() {}
          };
        }
      `
    })
  );
  await openComparison(page);
  await pickFirst(page, 'guardian');
  await page.locator('[data-bc-run]').click();
  await expect.poll(() => page.evaluate(() => window.comparisonJobs?.length)).toBe(1);
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  const finish = (damage) =>
    page.evaluate((totalDamage) => {
      window.comparisonJobs.shift()({
        durationMs: 10000,
        damage: [
          { t: 1000, v: totalDamage / 5 },
          { t: 10000, v: totalDamage }
        ],
        dps: totalDamage / 10,
        totalDamage,
        targetDied: true,
        warnings: []
      });
    }, damage);
  const pixels = () =>
    page.locator('[data-bc-canvas]').evaluate(async (canvas) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canvas.toDataURL()));
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    });
  const click = (selector) => page.locator(selector).evaluate((button) => button.click());
  await finish(500000);
  const initial = await pixels();
  await page.clock.runFor(200);
  const revealing = await pixels();
  expect(revealing).not.toBe(initial);
  await page.clock.runFor(1000);
  const complete = await pixels();
  expect(complete).not.toBe(revealing);

  await click('[data-bc-visible]');
  await click('[data-bc-visible]');
  expect(await pixels()).toBe(complete);
  await click('[data-bc-pick][aria-pressed="true"]');
  await click('[data-bc-pick]:enabled >> nth=0');
  expect(await pixels()).toBe(complete);
  await page.clock.runFor(1000);
  expect(await pixels()).toBe(complete);

  await click('[data-bc-pick]:enabled >> nth=1');
  await click('[data-bc-run]');
  expect(await page.evaluate(() => window.comparisonJobs.length)).toBe(1);
  await finish(250000);
  // Adding a new curve must leave the previously completed curve fully drawn.
  expect(await pixels()).toBe(complete);
  await page.clock.runFor(200);
  const added = await pixels();
  expect(added).not.toBe(complete);
  await page.clock.runFor(1000);
  expect(await pixels()).not.toBe(added);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await click('[data-bc-run]');
  await finish(500000);
  await finish(250000);
  const reduced = await pixels();
  await page.clock.runFor(1000);
  expect(await pixels()).toBe(reduced);
});
