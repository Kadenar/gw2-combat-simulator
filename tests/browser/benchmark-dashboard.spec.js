import { expect, test } from '@playwright/test';

async function openDashboard(page, path = '/mesmer.html#benchmarks') {
  await page.goto(path);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
}

// Home-page users can reach the all-profession tool directly, including in an embedded host.
test('home page links directly to benchmarks and preserves hosting modes', async ({ page }) => {
  await page.goto('/index.html');
  const link = page.getByRole('link', { name: 'Benchmarks', exact: false });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'elementalist.html#benchmarks');
  await page.goto('/index.html?embed=1&standalone=1');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'elementalist.html?embed=1&standalone=1#benchmarks');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/elementalist\.html\?embed=1&standalone=1#benchmarks$/);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-benchmark-cards]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Build benchmarks', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

// Native controls must update both chart surfaces and recover from empty searches without losing focus.
test('benchmark filters, card scrolling, and APM point inspection work with keyboard input', async ({ page }) => {
  await openDashboard(page);
  const search = page.getByRole('searchbox', { name: 'Search benchmarks' });
  await search.fill('Chronomancer');
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  await expect(page.locator('.scatter-point').first()).toBeVisible();
  const point = page.locator('.scatter-point').first();
  await point.focus();
  await expect(page.locator('[data-point-detail]')).toHaveText(await point.getAttribute('aria-label'));
  await page.keyboard.press('Enter');
  await expect(point).toHaveClass(/is-selected/);
  await search.fill('no-such-benchmark');
  await expect(page.locator('[data-apm-chart]')).toContainText('No matching benchmarks');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(search).toHaveValue('');
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  const sort = page.getByRole('combobox', { name: 'Sort by' });
  await sort.selectOption({ label: 'Lowest APM' });
  await expect(sort).toHaveValue('apm');
  const apmGroups = await page
    .locator('.benchmark-card')
    .evaluateAll((cards) =>
      cards.map((card) =>
        Array.from(card.querySelectorAll('[data-build-apm]'), (span) =>
          Number(span.textContent.match(/^[\d.]+/)?.[0] ?? Infinity)
        )
      )
    );
  for (const values of apmGroups) expect(values).toEqual([...values].sort((a, b) => a - b));
  const firstValues = apmGroups.map((values) => values[0] ?? Infinity);
  expect(firstValues).toEqual([...firstValues].sort((a, b) => a - b));
  const cardScroll = page.locator('.benchmark-card-scroll').first();
  await cardScroll.focus();
  await page.keyboard.press('PageDown');
  await expect.poll(() => cardScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.locator('select[data-overview-profession]').selectOption('elementalist');
  await expect(page.locator('#benchmarks-mesmer')).toHaveCount(0);
  await expect(page.locator('.scatter-point.profession-card-mesmer')).toHaveCount(0);
});

// Cards and the sortable overview table share their filters, ordering, and saved-build links across navigation.
test('build overview switches between concise cards and a sortable table', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openDashboard(page);
  const view = page.getByRole('group', { name: 'Build benchmark view' });
  const cards = page.locator('[data-benchmark-cards]');
  const table = page.locator('[data-build-table]');
  await expect(view.getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toBeVisible();
  const cardCount = await cards.locator('.build-benchmark').count();
  const firstLink = cards.locator('.benchmark-build-name').first();
  const destination = new URL(await firstLink.getAttribute('href'), page.url());
  expect(destination.searchParams.has('benchmark')).toBe(true);
  expect(destination.searchParams.has('rotation')).toBe(true);
  const card = cards.locator('.benchmark-card').first();
  const before = await cards.boundingBox();
  const cardViewport = card.locator('.benchmark-card-scroll');
  const cardHeight = (await card.boundingBox()).height;
  await cardViewport.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => cardViewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect((await cards.boundingBox()).height).toBe(before.height);
  expect((await card.boundingBox()).height).toBe(cardHeight);
  expect(await cardViewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  const heights = await cards
    .locator('.benchmark-card-scroll')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  await view.getByRole('button', { name: 'Table', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(cards).toBeHidden();
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(cardCount);
  await expect(table.locator('thead')).toContainText('Damage type');
  await expect(table.locator('thead')).toContainText('Actions');
  // Action labels must fit inside their hit areas, with room between links and the scrollbar.
  const actions = table.locator('.benchmark-overview-actions').first();
  const bounds = await actions.locator('a').evaluateAll((links) =>
    links.map((link) => {
      const text = document.createRange();
      text.selectNodeContents(link);
      const label = text.getBoundingClientRect();
      const button = link.getBoundingClientRect();
      return { left: button.left, right: button.right, labelLeft: label.left, labelRight: label.right };
    })
  );
  expect(bounds).toHaveLength(2);
  for (const button of bounds) {
    expect(button.labelLeft).toBeGreaterThan(button.left);
    expect(button.labelRight).toBeLessThan(button.right);
  }

  expect(bounds[1].left - bounds[0].right).toBeGreaterThanOrEqual(8);
  const viewportRight = await table
    .locator('.benchmark-overview-table-scroll')
    .evaluate((node) => node.getBoundingClientRect().left + node.clientWidth);
  expect(bounds[1].right).toBeLessThan(viewportRight);
  const dps = table.locator('[data-build-sort="dps"]');
  await dps.click();
  await expect(dps).toBeFocused();
  await expect(dps.locator('..')).toHaveAttribute('aria-sort', 'descending');
  const numbers = async (field) =>
    (await table.locator(`[data-build-${field}]`).allTextContents()).map((text) => Number(text.replaceAll(',', '')));
  const descending = await numbers('dps');
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
  await dps.press('Enter');
  await expect(dps.locator('..')).toHaveAttribute('aria-sort', 'ascending');
  expect(await numbers('dps')).toEqual([...descending].reverse());
  await table.locator('[data-build-sort="apm"]').click();
  const apm = await numbers('apm');
  expect(apm).toEqual([...apm].sort((a, b) => a - b));
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('Chronomancer');
  const filtered = await table.locator('tbody tr').count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(cardCount);
  await expect(table.locator('tbody tr').first()).toContainText('Chronomancer');
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await expect(table).toBeVisible();
  await view.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(cards.locator('.benchmark-card')).toHaveCount(1);
  await expect(cards.locator('.build-benchmark')).toHaveCount(filtered);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  for (const width of [768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await view.getByRole('button', { name: 'Table', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scroll = table.getByRole('region', { name: 'Build benchmarks table' });
    expect(await scroll.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    await view.getByRole('button', { name: 'Cards', exact: true }).click();
  }
});

// Charts and filters must remain readable in the native layout at both ends of the supported width range.
test('benchmark chart layout fits desktop and narrow mobile viewports', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const plot = page.locator('[data-apm-chart] .scatter-plot');
    expect((await plot.boundingBox()).width).toBeGreaterThan(100);
    expect((await plot.boundingBox()).height).toBeLessThanOrEqual(300);
    const labels = await page
      .locator('.scatter-x-axis span')
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getClientRects().length)
          .map((node) => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }))
      );
    for (let index = 1; index < labels.length; index += 1)
      expect(labels[index].left).toBeGreaterThan(labels[index - 1].right);
  }

  await page.getByRole('button', { name: 'DPS by health', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await page.locator('.benchmark-card').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.benchmark-card').first()).toBeInViewport();
});

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
  await page.route('**/data/gw2/builds/elementalist/*.json', async (route) => {
    if (!firstUrl) firstUrl = route.request().url();
    if (route.request().url() === firstUrl) firstRequests += 1;
    if (!heldRequest) heldRequest = route;
    else await route.continue();
  });
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await page.locator('[data-bar-profession]').selectOption('elementalist');
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
    if (/\/builds\/elementalist\/b-/.test(request.url())) buildRequests += 1;
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
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageTop);
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

// Cross-profession opening uses the selected manifest entry and adds a tab without replacing existing builds.
test('inspector opens its selected benchmark and rotation in the profession workspace', async ({ page }) => {
  await openDashboard(page, '/mesmer.html?embed=1&standalone=1#benchmarks');
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await page.locator('[data-bar-profession]').selectOption('elementalist');
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

test('health-band chart switches build scope and supports point inspection', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS by health', exact: true }).click();
  const mode = page.locator('[data-health-metric]');
  await expect(mode).toHaveValue('cumulative');
  await expect(page.locator('.health-x-axis')).toHaveText('80%60%40%20%0%');
  const ticks = page.locator('[data-health-chart] .comparison-y-axis span');
  expect(await ticks.count()).toBeGreaterThan(3);
  expect(await page.locator('.health-plot .scatter-grid i').count()).toBe(await ticks.count());
  expect(Number((await ticks.last().textContent()).replaceAll(',', ''))).toBeGreaterThan(0);
  const point = page.locator('[data-health-point]').first();
  await point.focus();
  await expect(page.locator('[data-health-detail]')).toHaveText(await point.getAttribute('aria-label'));
  await expect(point).toHaveAttribute('aria-label', /cumulative DPS$/);
  await mode.selectOption('phase');
  await expect(point).toHaveAttribute('aria-label', /phase DPS$/);
  await expect(page.locator('.health-x-axis')).toHaveText('100-80%80-60%60-40%40-20%20-0%');
  const select = page.locator('[data-health-builds]');
  await select.selectOption('all');
  await expect(select).toHaveValue('all');
  await page.locator('.health-values summary').click();
  await expect(page.locator('.health-values table')).toBeVisible();
  // Phase filtering keeps the plot and table in sync while retaining the selected DPS metric.
  const phase = page.locator('[data-health-phase]');
  await expect(phase).toHaveValue('all');
  await phase.selectOption('60-40');
  await expect(page.locator('.health-x-axis')).toHaveText('60-40%');
  await expect(page.locator('.health-values thead th')).toHaveCount(2);
  await expect(page.locator('.health-values table')).toBeVisible();
  await expect(point).toHaveAttribute('aria-label', /60-40%: .* phase DPS$/);
  await expect(page.locator('.health-line')).toHaveCount(0);
  await mode.selectOption('cumulative');
  await expect(phase).toHaveValue('60-40');
  await expect(page.locator('.health-x-axis')).toHaveText('40%');
  await expect(point).toHaveAttribute('aria-label', /40%: .* cumulative DPS$/);
  await phase.selectOption('all');
  await expect(page.locator('.health-values thead th')).toHaveCount(6);
  await phase.selectOption('20-0');
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('no-such-benchmark');
  await expect(page.locator('[data-health-chart]')).toContainText('No completed health bands');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(select).toHaveValue('top');
  await expect(mode).toHaveValue('cumulative');
  await expect(phase).toHaveValue('all');
  await expect(page.locator('[data-health-point]').first()).toBeVisible();
});

// Table sorting preserves the chart and disclosure, and follows the selected DPS metric across mode changes.
test('health values sort by build and each health column with mouse and keyboard', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'DPS by health', exact: true }).click();
  await page.locator('.health-values summary').click();
  const table = page.locator('.health-values table');
  const names = () => table.locator('tbody th').allTextContents();
  const values = async (column) =>
    (await table.locator(`tbody td:nth-child(${column + 2})`).allTextContents()).map((value) =>
      value === '—' ? null : Number(value.replaceAll(',', ''))
    );
  const expectOrder = async (column, ascending) => {
    const actual = await values(column);
    const measured = actual.filter((value) => value !== null).sort((a, b) => (ascending ? a - b : b - a));
    expect(actual).toEqual([...measured, ...actual.filter((value) => value === null)]);
  };

  const initialNames = await names();
  expect(initialNames).toEqual([...initialNames].sort((a, b) => a.localeCompare(b)));
  await table.locator('[data-health-sort="name"]').press('Enter');
  expect(await names()).toEqual([...initialNames].reverse());
  const plot = await page.locator('.health-plot').innerHTML();
  for (const [column, key] of ['100-80', '80-60', '60-40', '40-20', '20-0'].entries()) {
    const button = table.locator(`[data-health-sort="${key}"]`);
    await button.click();
    await expect(button).toBeFocused();
    await expect(button.locator('..')).toHaveAttribute('aria-sort', 'descending');
    await expectOrder(column, false);
    await button.press('Enter');
    await expect(button.locator('..')).toHaveAttribute('aria-sort', 'ascending');
    await expectOrder(column, true);
  }

  expect(await page.locator('.health-plot').innerHTML()).toBe(plot);
  await page.locator('[data-health-metric]').selectOption('phase');
  await expect(table).toBeVisible();
  await expect(table.locator('[data-health-sort="20-0"]')).toHaveText('20-0% ↑');
  await expectOrder(4, true);
  await page.locator('[data-health-builds]').selectOption('all');
  await expect(table).toBeVisible();
  await expectOrder(4, true);
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
  await page.locator('[data-bar-profession]').focus();
  await expect(inspection).toBeHidden();
});

// Build identity stays visually consistent across chart types; bar scrolling must not widen a mobile page.
test('profession bar charts use distinct build colors and share filters with the other charts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'Compare Elementalist DPS / APM by build' }).click();
  const select = page.locator('[data-bar-profession]');
  await expect(select).toHaveValue('elementalist');
  const bars = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const colors = await bars.evaluateAll((nodes) =>
    nodes.map((node) => node.style.getPropertyValue('--benchmark-color'))
  );
  expect(new Set(colors).size).toBe(colors.length);
  const first = bars.first();
  const label = await first.getAttribute('aria-label');
  await first.focus();
  await expect(page.locator('[data-bar-metric="dps"] [data-bar-detail]')).toHaveText(label);
  await expect(page.locator('#benchmark-build-inspector-dps')).toBeHidden();
  expect((await first.locator('.benchmark-bar-column').boundingBox()).height).toBeGreaterThanOrEqual(440);
  await page.getByRole('button', { name: 'DPS vs APM', exact: true }).click();
  const sameBuild = page.locator('[data-apm-chart]').getByRole('button', { name: label, exact: true });
  expect(await sameBuild.evaluate((node) => node.style.getPropertyValue('--benchmark-color'))).toBe(colors[0]);
  await page.getByRole('button', { name: 'DPS / APM by Build', exact: true }).click();
  await select.selectOption('mesmer');
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
  const profession = page.getByRole('combobox', { name: 'Profession', exact: true });
  const specialization = page.getByRole('combobox', { name: 'Specialization', exact: true });
  const dps = page.locator('[data-bar-metric="dps"] [data-bar-point]');
  const apm = page.locator('[data-bar-metric="apm"] [data-bar-point]');
  await expect(profession).toHaveValue('all');
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup')).toHaveCount(9);
  await profession.selectOption('mesmer');
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
  await profession.selectOption('all');
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup')).toHaveCount(9);
  const allCount = await dps.count();
  expect(allCount).toBeGreaterThan(labels.length);
  await expect(apm).toHaveCount(allCount);
  await specialization.selectOption({ label: 'Weaver' });
  await expect(dps.first()).toHaveAttribute('aria-label', /^Elementalist · Weaver ·/);
  await expect(apm).toHaveCount(await dps.count());
  await page.getByRole('checkbox', { name: 'Elementalist', exact: true }).uncheck();
  await expect(specialization).toHaveValue('all');
  await expect(specialization.locator('optgroup[label="Elementalist"]')).toHaveCount(0);
  await expect(page.locator('[data-bar-chart] .benchmark-bar')).not.toHaveCount(0);
  await profession.selectOption('mesmer');
  await expect(specialization.locator('option[value="elementalist:Weaver"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(profession).toHaveValue('all');
  await expect(specialization).toHaveValue('all');
});

// A failed manifest is disclosed and retryable while successful professions remain usable.
test('benchmarks report partial manifest failures and retry successfully', async ({ page }) => {
  await page.route('**/builds/mesmer/manifest.json', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await openDashboard(page);
  await expect(page.locator('[data-benchmark-status]')).toContainText('Could not load Mesmer');
  await expect(page.locator('#benchmarks-mesmer')).toContainText('Benchmark data unavailable');
  await expect(page.locator('.build-benchmark').first()).toBeVisible();
  await page.unroute('**/builds/mesmer/manifest.json');
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(page.locator('[data-benchmark-retry]')).toBeHidden();
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await expect(page.locator('#benchmarks-mesmer .build-benchmark').first()).toBeVisible();
});

test('benchmark navigation preserves the workspace, filters, browser history, and embedding', async ({ page }) => {
  await openDashboard(page, '/mesmer.html?embed=1&standalone=1#benchmarks');
  const navigation = page.getByRole('navigation', { name: 'Simulator sections' });
  await expect(navigation.getByRole('link', { name: 'Benchmarks', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await page.evaluate(() => {
    window.benchmarkTestBuild = window.professionApp.build;
  });
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('Chronomancer');
  await navigation.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.locator('#benchmarks-view')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#benchmarks-view')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search benchmarks' })).toHaveValue('Chronomancer');
  expect(await page.evaluate(() => window.professionApp.build === window.benchmarkTestBuild)).toBe(true);
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Mesmer workspace' })).toHaveAttribute(
    'href',
    /mesmer\.html\?embed=1&standalone=1/
  );
  await navigation.getByRole('button', { name: 'Choose profession' }).click();
  await page
    .getByRole('group', { name: 'Professions', exact: true })
    .getByRole('link', { name: 'Guardian', exact: true })
    .click();
  await expect(page).toHaveURL(/guardian\.html\?embed=1&standalone=1#benchmarks$/);
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
});
