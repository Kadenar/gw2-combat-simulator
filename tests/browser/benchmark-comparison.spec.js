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
  await expect(page.locator('[data-bc-status]')).toContainText('3 builds ready', { timeout: 90_000 });
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
  await page.locator('[data-bc-time]').fill('20');
  await page.screenshot({ path: testInfo.outputPath('elementalist-comparison.png'), fullPage: true });
  await page.locator('[data-bc-search]').fill('no matching builds');
  await page.locator('[data-bc-legend] button').nth(1).click();
  await page.getByRole('button', { name: 'Last 5s', exact: true }).click();
  expect(await styles()).toEqual(initial);
  await page.locator('[data-bc-search]').fill('');
  await page.locator('[data-bc-remove]').first().click();
  expect(await styles()).toEqual(initial.slice(1));
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
  expect(requests.some((url) => /\/data\/gw2\/builds\/[^/]+\/b-/.test(url))).toBe(false);
  expect(workers).toBe(0);
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-status]')).toContainText('2 builds ready', { timeout: 90_000 });
  expect(workers).toBe(2);
  await expect(page.locator('[data-bc-legend] button')).toHaveCount(2);
  await expect(page.locator('[data-bc-readout] tr')).toHaveCount(2);
  await page.locator('[data-bc-time]').fill('20');
  await expect(page.locator('[data-bc-pin]')).toHaveAttribute('aria-pressed', 'true');
  const before = await page.locator('[data-bc-readout]').textContent();
  await page.getByRole('button', { name: 'Last 1s', exact: true }).click();
  await expect(page.locator('[data-bc-title]')).toHaveText('1-second rolling DPS');
  expect(await page.locator('[data-bc-readout]').textContent()).not.toBe(before);
  await page.locator('[data-bc-legend] button').first().click();
  await expect(page.locator('[data-bc-legend] button').first()).toHaveAttribute('aria-pressed', 'false');
  const canvas = page.locator('[data-bc-canvas]');
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
  await expect(page.locator('[data-bc-pin]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-bc-time]').fill('20');
  await page.locator('[data-bc-time]').press('Escape');
  await expect(canvas).not.toBeFocused();
  await expect(page.locator('[data-bc-time]')).not.toBeFocused();
  await expect(page.locator('[data-bc-pin]')).toHaveAttribute('aria-pressed', 'false');
  await canvas.press('ArrowRight');
  await expect(page.locator('[data-bc-pin]')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.locator('[data-bc-status]')).toContainText('1 builds ready', { timeout: 90_000 });
});

test('leaving comparison terminates preparation and a later run uses a fresh worker', async ({ page }) => {
  test.setTimeout(120_000);
  await openComparison(page);
  await pickFirst(page, 'guardian');
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
  await page.route('**/data/gw2/builds/guardian/b-*.json*', async (route) => {
    received();
    await gate;
    await route.continue();
  });
  await page.locator('[data-bc-run]').click();
  await started;
  await expect(page.locator('[data-bc-cancel]')).toBeVisible();
  expect(workers).toBe(1);
  const closed = activeWorker.waitForEvent('close');
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await closed;
  release();
  await page.getByRole('button', { name: 'Simulate comparison', exact: true }).click();
  await expect(page.locator('[data-bc-status]')).toContainText('Run cancelled');
  await expect(page.locator('[data-bc-cancel]')).toBeHidden();
  expect(workers).toBe(1);
  await page.locator('[data-bc-run]').click();
  await expect(page.locator('[data-bc-status]')).toContainText('1 builds ready', { timeout: 90_000 });
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
    await expect(page.locator('[data-bc-status]')).toContainText('2 builds ready', { timeout: 90_000 });
    expect(workers).toBe(2);
    expect(assets).toHaveLength(4);
  }

  const imports = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(imports.filter((url) => /\/professions\/[^/]+\/(app\/app-definition|profession)\./.test(url))).toEqual([]);
});
