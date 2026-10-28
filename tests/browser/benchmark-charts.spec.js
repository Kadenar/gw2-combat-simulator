import { expect, test } from '@playwright/test';
import { openDashboard, selectProfessions } from '#tests/helpers/browser-benchmarks.js';

// Row inspection and point inspection stay linked through sorting and scrolling without moving the page.
test('APM table and graph share selection across sorting and scrolling', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  const chart = page.locator('[data-apm-chart]');
  expect(
    Number((await chart.locator('.scatter-x-axis span').first().textContent()).replaceAll(',', ''))
  ).toBeGreaterThan(0);
  expect(
    Number((await chart.locator('.comparison-y-axis span').last().textContent()).replaceAll(',', ''))
  ).toBeGreaterThan(0);
  expect(await chart.locator('.comparison-y-axis span').count()).toBeGreaterThan(3);
  const table = page.locator('[data-apm-table]');
  await expect(table.locator('tbody tr')).toHaveCount(await chart.locator('[data-point]').count());
  const row = table.locator('tbody tr').first();
  const index = await row.getAttribute('data-apm-row');
  await row.hover();
  await expect(page.locator(`[data-point="${index}"]`)).toHaveClass(/is-selected/);
  await row.locator('button').focus();
  await expect(row).toHaveClass(/is-selected/);
  await table.locator('[data-apm-sort="dps"]').click();
  await expect(table.locator('th[aria-sort="descending"]')).toHaveText(/DPS/);
  await expect(table.locator('[data-apm-sort="dps"]')).toBeFocused();
  const scroll = table.getByRole('region', { name: 'Benchmark table' });
  await scroll.hover();
  await page.mouse.wheel(0, 350);
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  const last = table.locator('tbody tr').last();
  const lastIndex = await last.getAttribute('data-apm-row');
  const point = page.locator(`[data-point="${lastIndex}"]`);
  const pageTop = await page.evaluate(() => window.scrollY);
  await point.evaluate((node) => node.focus({ preventScroll: true }));
  await expect(last).toHaveClass(/is-selected/);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);
  const viewport = await scroll.boundingBox();
  const rowBounds = await last.boundingBox();
  expect(rowBounds.y + rowBounds.height).toBeLessThanOrEqual(viewport.y + viewport.height + 1);
  const heading = await table.locator('thead').boundingBox();
  expect(Math.abs(heading.y - viewport.y)).toBeLessThan(2);
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('no-such-benchmark');
  await expect(table).toHaveCount(0);
});

// Wheel gestures over the bars pan their own viewport; horizontal trackpads and the surrounding page stay native.
test('mouse wheel pans build bars horizontally without scrolling the page', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  const scroll = page.locator('[data-bar-metric="dps"] .bar-chart-scroll');
  await scroll.hover();
  const pageTop = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 350);
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);
  const firstOffset = await scroll.evaluate((element) => element.scrollLeft);
  await page.mouse.wheel(250, 0);
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(firstOffset);
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.locator('.benchmark-bar-controls').hover();
  const controlsTop = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(controlsTop);
});

// The second chart preserves build identity and supports the same native hover, wheel, and click inspection.
test('APM bars sit below DPS and open their own inspector without reserving space in the DPS chart', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  const dps = page.locator('[data-bar-metric="dps"]');
  const apm = page.locator('[data-bar-metric="apm"]');
  const identities = (chart) =>
    chart.locator('[data-bar-point]').evaluateAll((bars) =>
      bars.map((bar) => ({
        id: bar.dataset.barPoint,
        color: bar.style.getPropertyValue('--benchmark-color')
      }))
    );
  expect(await identities(apm)).toEqual(await identities(dps));
  const dpsBounds = await dps.boundingBox();
  expect((await apm.boundingBox()).y).toBeGreaterThan(dpsBounds.y + dpsBounds.height);
  expect(await apm.evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom))).toBeGreaterThanOrEqual(32);
  await expect(apm.locator('.bar-y-axis')).toContainText('APM');
  const dpsWidth = (await dps.locator('.bar-chart-frame').boundingBox()).width;
  await dps.locator('.benchmark-bar-label').first().click();
  await expect(dps.locator('.benchmark-build-inspector')).toBeVisible();
  const scroll = apm.locator('.bar-chart-scroll');
  await scroll.scrollIntoViewIfNeeded();
  await scroll.hover();
  await page.mouse.wheel(0, 350);
  await expect.poll(() => scroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  const point = apm.locator('[data-bar-point]').last();
  await point.focus();
  await expect(apm.locator('[data-bar-detail]')).toHaveText(await point.getAttribute('aria-label'));
  await expect(apm.locator('.benchmark-build-inspector')).toBeHidden();
  await point.press('Enter');
  await expect(apm.locator('.benchmark-build-inspector')).toBeVisible();
  await expect(apm.locator('[data-open-benchmark]')).toHaveAttribute('href', /benchmark=.*rotation=/);
  await expect(point).toBeInViewport();
  await expect(dps.locator('.benchmark-build-inspector')).toBeHidden();
  expect((await dps.locator('.bar-chart-frame').boundingBox()).width).toBe(dpsWidth);
  await apm.getByRole('button', { name: 'Close build inspector' }).click();
  await expect(point).toBeFocused();
  await expect(apm.locator('.benchmark-build-inspector')).toBeHidden();
});

// Inspection belongs inside the plot, with equivalent pointer/keyboard behavior and an explicit dismissal.
test('chart inspection stays in the top-left of the canvas and can be dismissed', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('Weaver');
  for (const panel of ['apm', 'health']) {
    await page.locator(`[data-benchmark-panel="${panel}"]`).click();
    const chart = page.locator(`[data-${panel}-chart]`);
    const point = chart.locator('.scatter-point').first();
    await point.hover();
    const inspection = chart.locator('.benchmark-inspection');
    await expect(inspection).toBeVisible();
    const plotBounds = await chart.locator('.scatter-plot').boundingBox();
    const detailBounds = await inspection.boundingBox();
    expect(detailBounds.x - plotBounds.x).toBeLessThan(20);
    expect(detailBounds.y - plotBounds.y).toBeLessThan(20);
    await page.locator(`[data-benchmark-panel="${panel}"]`).hover();
    await expect(inspection).toBeHidden();
    await point.focus();
    await expect(inspection).toBeVisible();
    await inspection.getByRole('button', { name: 'Close benchmark details' }).click();
    await expect(inspection).toBeHidden();
    await expect(point).toBeFocused();
    await page.keyboard.press('Enter');

    if (panel === 'apm') await expect(chart.locator('#benchmark-scatter-inspector')).toBeVisible();
    else await expect(inspection).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(inspection).toBeHidden();
  }
});

// Empty columns and departed pointers must not leave a badge covering the bars.
test('bar inspection only appears over a bar or label and clears when pointer or focus leaves', async ({ page }) => {
  await openDashboard(page);
  const tab = page.getByRole('button', { name: 'DPS / APM by Build', exact: true });
  await tab.click();
  const chart = page.locator('[data-bar-metric="dps"]');
  const inspection = chart.locator('.benchmark-inspection');
  const bar = chart.locator('[data-bar-point]').first();
  await expect(inspection).toBeHidden();
  await bar.locator('.benchmark-bar-fill').hover();
  await expect(inspection).toBeVisible();
  await tab.hover();
  await expect(inspection).toBeHidden();
  await expect(tab).toBeFocused();
  await bar.locator('.benchmark-bar-column').hover({ position: { x: 5, y: 5 } });
  await expect(inspection).toBeHidden();
  await bar.locator('.benchmark-bar-fill').click();
  await expect(page.locator('#benchmark-build-inspector-dps')).toBeVisible();
  await expect(inspection).toBeHidden();
  await tab.hover();
  await expect(inspection).toBeHidden();
  await bar.blur();
  await bar.focus();
  await expect(inspection).toBeVisible();
  await page.locator('[data-bar-specialization]').focus();
  await expect(inspection).toBeHidden();
});

// Build identity stays visually consistent across chart types; bar scrolling must not widen a mobile page.
test('profession bar charts retain build colors across views and share filters with the other charts', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'Compare Elementalist DPS / APM by build' }).click();
  await expect(page.locator('[data-benchmark-profession="elementalist"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'false');
  const bars = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const color = await bars.first().evaluate((node) => node.style.getPropertyValue('--benchmark-color'));
  // The rendered bar uses its profession's theme; Node tests cover palette generation and uniqueness.
  const accent = await page
    .locator('[data-benchmark-profession="elementalist"]')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--accent').trim());
  expect(accent).not.toBe('');
  expect(color).toContain(accent);
  await expect(bars.first().locator('.benchmark-bar-fill')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const first = bars.first();
  const label = await first.getAttribute('aria-label');
  await first.focus();
  await expect(page.locator('[data-bar-metric="dps"] [data-bar-detail]')).toHaveText(label);
  await expect(page.locator('#benchmark-build-inspector-dps')).toBeHidden();
  expect((await first.locator('.benchmark-bar-column').boundingBox()).height).toBeGreaterThanOrEqual(440);
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  const sameBuild = page.locator('[data-apm-chart]').getByRole('button', { name: label, exact: true });
  expect(await sameBuild.evaluate((node) => node.style.getPropertyValue('--benchmark-color'))).toBe(color);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await selectProfessions(page, 'mesmer');
  await expect(bars.first()).toHaveAttribute('aria-label', /^Mesmer/);
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('no-such-benchmark');
  await expect(page.locator('[data-bar-chart]')).toContainText('No benchmarks match');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await bars.last().focus();
    await expect(bars.last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(
      await page.locator('[data-bar-metric="dps"] .bar-chart-scroll').evaluate((node) => node.scrollLeft)
    ).toBeGreaterThan(0);
    const frame = await page.locator('[data-bar-metric="dps"] .bar-chart-frame').boundingBox();
    const detail = await page.locator('[data-bar-metric="dps"] .benchmark-inspection').boundingBox();
    expect(detail.y - frame.y).toBeLessThan(20);
    expect(detail.x + detail.width).toBeLessThanOrEqual(width);
  }
});

// Profession scope controls specialization choices and filters both bar charts together.
test('build charts support all professions and profession-specific specialization selection', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  const all = page.locator('[data-benchmark-profession="all"]');
  const specialization = page.getByRole('combobox', { name: 'Specialization', exact: true });
  const dps = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const apm = page.locator('[data-bar-metric="apm"] [data-bar-point]');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup')).toHaveCount(9);
  await selectProfessions(page, 'mesmer');
  await expect(specialization.locator('option')).toContainText([
    'All',
    'Chronomancer',
    'Mirage',
    'Troubadour',
    'Virtuoso'
  ]);
  await specialization.focus();
  await specialization.selectOption({ label: 'Chronomancer' });
  await expect(specialization).toBeFocused();
  const labels = await dps.evaluateAll((bars) => bars.map((bar) => bar.getAttribute('aria-label')));
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => label.startsWith('Mesmer · Chronomancer ·'))).toBe(true);
  await expect(apm).toHaveCount(labels.length);
  await all.click();
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup')).toHaveCount(9);
  const allCount = await dps.count();
  expect(allCount).toBeGreaterThan(labels.length);
  await expect(apm).toHaveCount(allCount);
  await specialization.selectOption({ label: 'Weaver' });
  await expect(dps.first()).toHaveAttribute('aria-label', /^Elementalist · Weaver ·/);
  await expect(apm).toHaveCount(await dps.count());
  await page.locator('[data-benchmark-profession="elementalist"]').click();
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup[label="Elementalist"]')).toHaveCount(0);
  await expect(page.locator('[data-bar-chart] .benchmark-bar')).not.toHaveCount(0);
  await selectProfessions(page, 'mesmer');
  await expect(specialization.locator('option[value="elementalist:Weaver"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(specialization).toHaveValue('all');
});
