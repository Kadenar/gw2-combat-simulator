import { expect, test } from '@playwright/test';
import { openDashboard, selectProfessions } from '#tests/helpers/browser-benchmarks.js';

// Clicking either surface opens the same cached build details; hovering never changes a pinned build.
test('APM rows and points open a persistent build inspector with a workspace link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  const chart = page.locator('[data-apm-chart]');
  const plot = chart.locator('.scatter-plot');
  const width = (await plot.boundingBox()).width;
  const inspector = chart.locator('#benchmark-scatter-inspector');
  const row = chart.locator('[data-apm-row]').first();
  await row.hover();
  await expect(inspector).toBeHidden();
  expect((await plot.boundingBox()).width).toBe(width);
  await row.locator('td').first().click();
  await expect(inspector).toBeVisible();
  await expect(row.locator('button')).toHaveAttribute('aria-expanded', 'true');
  await expect(inspector.locator('.benchmark-preview-equipment')).toBeVisible();
  const preview = inspector.locator('[data-build-preview]');
  const build = await preview.getAttribute('data-build');
  const link = inspector.getByRole('link', { name: 'Open in workspace' });
  expect(new URL(await link.getAttribute('href'), page.url()).searchParams.get('benchmark')).toBe(build);
  expect((await plot.boundingBox()).width).toBeLessThan(width);
  await chart.locator('[data-apm-sort="dps"]').click();
  await chart.locator('[data-apm-row]').last().hover();
  await expect(preview).toHaveAttribute('data-build', build);
  const point = chart.locator('[data-point]:not([aria-expanded="true"])').first();
  const pointIndex = await point.getAttribute('data-point');
  await point.focus();
  await point.press('Enter');
  await expect(chart.locator(`[data-point="${pointIndex}"]`)).toHaveAttribute('aria-expanded', 'true');
  await expect(preview).not.toHaveAttribute('data-build', build);
  await inspector.getByRole('button', { name: 'Close build inspector' }).click();
  await expect(inspector).toBeHidden();
  await expect(chart.locator(`[data-point="${pointIndex}"]`)).toBeFocused();
  expect((await plot.boundingBox()).width).toBe(width);
  await page.setViewportSize({ width: 375, height: 1000 });
  await row.locator('button').focus();
  await page.keyboard.press('Enter');
  await expect(inspector).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
});

// Clicked previews must neither overwrite a newer selection nor change the workspace's active build.
test('bar previews load saved builds, cache requests, and ignore stale responses', async ({ page }) => {
  await openDashboard(page);
  await page.evaluate(() => {
    window.benchmarkTestBuild = window.professionApp.build;
  });
  let heldRequest;
  let firstUrl;
  let firstRequests = 0;
  await page.route('**/data/gw2/benchmark-previews/elementalist/*.json', async (route) => {
    if (!firstUrl) firstUrl = route.request().url();

    if (route.request().url() === firstUrl) firstRequests += 1;

    if (!heldRequest) heldRequest = route;
    else await route.continue();
  });
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await selectProfessions(page, 'elementalist');
  const bars = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const preview = page.locator('[data-bar-metric="dps"] [data-build-preview]');
  await bars.first().locator('.benchmark-bar-label').click();
  await expect.poll(() => Boolean(heldRequest)).toBe(true);
  await bars.nth(1).locator('.benchmark-bar-label').click();
  await expect(preview.locator('.benchmark-preview-equipment')).toBeVisible();
  const secondBuild = await preview.getAttribute('data-build');
  const secondContents = await preview.innerHTML();
  await heldRequest.continue();
  await expect(preview).toHaveAttribute('data-build', secondBuild);
  await expect(preview).toHaveJSProperty('innerHTML', secondContents);
  await bars.first().locator('.benchmark-bar-label').click();
  await expect(preview.locator('.benchmark-preview-equipment')).toBeVisible();
  await expect(preview.locator('.benchmark-preview-traits')).toHaveCount(3);
  expect(firstRequests).toBe(1);
  expect(await page.evaluate(() => window.professionApp.build === window.benchmarkTestBuild)).toBe(true);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).focus();
  await expect(page.locator('#benchmark-build-inspector-dps')).toBeVisible();
});

// Health-band comparisons expose the same inspection on keyboard and touch, and retain exact values in a table.
test('bar hover does not resize or load a build; clicked inspector persists and closes back to full width', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  let buildRequests = 0;
  page.on('request', (request) => {
    if (/\/(?:builds|benchmark-previews)\/elementalist\/b-/.test(request.url())) buildRequests += 1;
  });
  const plot = page.locator('[data-bar-metric="dps"] .bar-chart-frame');
  const fullWidth = (await plot.boundingBox()).width;
  const bars = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const inspector = page.locator('#benchmark-build-inspector-dps');
  await bars.first().locator('.benchmark-bar-fill').hover();
  await expect(page.locator('[data-bar-metric="dps"] [data-bar-detail]')).toBeVisible();
  await expect(inspector).toBeHidden();
  expect((await plot.boundingBox()).width).toBe(fullWidth);
  expect(buildRequests).toBe(0);
  await bars.last().focus();
  await page.keyboard.press('Enter');
  await expect(inspector).toBeVisible();
  await expect(bars.last()).toHaveAttribute('aria-expanded', 'true');
  await expect(bars.last()).toBeInViewport();
  const openWidth = (await plot.boundingBox()).width;
  expect(openWidth).toBeLessThan(fullWidth);
  const bounds = await plot.boundingBox();
  expect((await inspector.boundingBox()).x).toBeGreaterThanOrEqual(bounds.x + bounds.width);
  const selectedBuild = await page.locator('[data-bar-metric="dps"] [data-build-preview]').getAttribute('data-build');
  await bars.first().locator('.benchmark-bar-label').hover();
  await expect(page.locator('[data-bar-metric="dps"] [data-build-preview]')).toHaveAttribute(
    'data-build',
    selectedBuild
  );
  expect((await plot.boundingBox()).width).toBe(openWidth);
  await inspector.getByRole('button', { name: 'Close build inspector' }).click();
  await expect(inspector).toBeHidden();
  await expect(bars.last()).toBeFocused();
  expect((await plot.boundingBox()).width).toBe(fullWidth);
  await page.keyboard.press('Enter');
  await expect(inspector).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  // Escape clears chart focus as well as inspection, while the close button above still restores focus.
  await expect(bars.last()).not.toBeFocused();
  await expect(bars.last()).toHaveCSS('outline-style', 'none');
  await expect(bars.last().locator('.benchmark-bar-label')).toHaveCSS('outline-style', 'none');
  await bars.last().focus();
  await page.keyboard.press('Escape');
  await expect(bars.last()).not.toBeFocused();
  await expect(page.locator('[data-bar-metric="dps"] [data-bar-detail]')).toBeHidden();
});

// Cross-profession opening uses the selected manifest entry and adds a tab without replacing existing builds.
test('inspector opens its selected benchmark and rotation in the profession workspace', async ({ page }) => {
  await openDashboard(page, '/mesmer.html?embed=1&standalone=1#benchmarks');
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await selectProfessions(page, 'elementalist');
  await page.locator('[data-bar-metric="dps"] [data-bar-point]').first().locator('.benchmark-bar-label').click();
  const link = page.getByRole('link', { name: 'Open in workspace', exact: true });
  const destination = new URL(await link.getAttribute('href'), page.url());
  expect(destination.searchParams.get('embed')).toBe('1');
  expect(destination.searchParams.get('standalone')).toBe('1');
  const build = await (await page.request.get(destination.searchParams.get('benchmark'))).json();
  await link.click();
  await expect(page).toHaveURL(/elementalist\.html\?embed=1&standalone=1#workspace$/);
  await expect.poll(() => page.evaluate(() => window.professionApp?.workspace.tabs.length)).toBe(2);
  const actual = await page.evaluate(() => ({
    profession: window.professionApp.build.profession,
    weapons: window.professionApp.build.weapons,
    hasRotation: window.professionApp.build.rotation.length > 0
  }));
  expect(actual).toEqual({ profession: build.profession, weapons: build.weapons, hasRotation: true });
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.workspace.tabs.length)).toBe(2);
});

// Table activation uses native buttons for keyboard access and preserves selection across ranking changes.
test('build benchmark table rows open previews, survive sorting, and dismiss accessibly', async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/benchmarks.html?profession=revenant');
  const table = page.locator('[data-build-table]');
  const row = table.locator('[data-overview-row]').filter({ hasText: 'Power Renegade (Hammer)' });
  const trigger = row.locator('[data-inspect-overview]');
  const inspector = table.locator('#benchmark-overview-inspector');
  await expect(trigger).toBeVisible();
  await expect(inspector).toBeHidden();
  await row.locator('[data-build-dps]').click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(row).toHaveClass(/is-inspected/);
  await expect(inspector.locator('.benchmark-preview-equipment')).toContainText('Hammer');
  const build = await inspector.locator('[data-build-preview]').getAttribute('data-build');
  await table.locator('[data-build-sort="apm"]').click();
  await expect(inspector.locator('[data-build-preview]')).toHaveAttribute('data-build', build);
  await expect(row).toHaveClass(/is-inspected/);
  await inspector.getByRole('button', { name: 'Close build inspector' }).click();
  await expect(trigger).toBeFocused();
  await expect(inspector).toBeHidden();
  await trigger.press('Enter');
  await expect(inspector).toBeVisible();
  await trigger.press('Escape');
  await expect(inspector).toBeHidden();
  await expect(trigger).not.toBeFocused();
  await expect(trigger).toHaveCSS('outline-style', 'none');
  await expect(trigger).toHaveCSS('text-decoration-line', 'none');
  await trigger.focus();
  await trigger.press('Space');
  await expect(inspector).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('Vindicator');
  await expect(inspector).toBeHidden();
  await expect(table.locator('.is-inspected')).toHaveCount(0);

  // The preview provides the only workspace link, preserving normal modified-click navigation.
  await table.locator('[data-inspect-overview]').first().click();
  const workspace = inspector.getByRole('link', { name: 'Open in workspace' });
  await expect(table.locator('a[href*="#workspace"]')).toHaveCount(1);
  await expect(table.locator('tbody a[href*="#workspace"]')).toHaveCount(0);
  const popupPromise = context.waitForEvent('page');
  await workspace.click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/revenant\.html\?.*benchmark=.*rotation=.*#workspace/);
  await popup.close();
  await expect(inspector).toBeVisible();
});

// Late responses cannot replace another table selection, and mobile inspection must fit outside horizontal scrolling.
test('table preview ignores stale selections and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/benchmarks.html?profession=revenant');
  const table = page.locator('[data-build-table]');
  const rows = table.locator('[data-overview-row]');
  const inspector = table.locator('#benchmark-overview-inspector');
  let held;
  await page.route('**/data/gw2/benchmark-previews/revenant/*.json', async (route) => {
    if (!held) held = route;
    else await route.continue();
  });
  await rows.first().locator('[data-inspect-overview]').click();
  await expect.poll(() => Boolean(held)).toBe(true);
  await rows.nth(1).locator('[data-inspect-overview]').click();
  await expect(inspector.locator('.benchmark-preview-equipment')).toBeVisible();
  // Image fallback URLs can change independently; stale responses must preserve the selected build's content.
  const preview = inspector.locator('[data-build-preview]');
  const contents = await preview.textContent();
  const selectedTraits = () =>
    preview.locator('.is-picked img').evaluateAll((images) => images.map((image) => image.alt));
  const traits = await selectedTraits();
  const completed = page.waitForResponse(held.request().url());
  await held.continue();
  await (await completed).finished();
  await expect(preview).toHaveText(contents);
  await expect.poll(selectedTraits).toEqual(traits);
  const bounds = await inspector.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await inspector.getByRole('button', { name: 'Close build inspector' }).click();
  await expect(rows.nth(1).locator('[data-inspect-overview]')).toBeFocused();
  await expect(inspector).toBeHidden();
});

// Standalone inspection must stay data-only even when profession and rotation requests cannot succeed.
test('standalone build previews load without profession modules or rotations and retry failed assets', async ({
  page
}) => {
  const forbidden = [];
  await page.route(/\/js\/games\/gw2\/professions\/|\/data\/gw2\/rotations\//, async (route) => {
    forbidden.push(route.request().url());
    await route.abort();
  });
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await selectProfessions(page, 'revenant');
  const bar = page.locator('[data-bar-metric="dps"] [data-bar-point]').filter({ hasText: 'Power Renegade (Hammer)' });
  const inspector = page.locator('#benchmark-build-inspector-dps');
  await page.route('**/data/gw2/benchmark-previews/revenant/*.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' })
  );
  await bar.locator('.benchmark-bar-label').click();
  await expect(inspector.locator('[data-build-preview]')).toHaveText('Build preview unavailable.');
  await inspector.getByRole('button', { name: 'Close build inspector' }).click();
  await page.unroute('**/data/gw2/benchmark-previews/revenant/*.json');
  await bar.locator('.benchmark-bar-label').click();
  await expect(inspector.locator('.benchmark-preview-equipment')).toContainText('Hammer');
  await expect(inspector.locator('.benchmark-preview-equipment')).toContainText('LegendaryRenegade');
  expect(forbidden).toEqual([]);
});
