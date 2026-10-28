import { expect, test } from '@playwright/test';

import { openDashboard, selectProfessions } from '#tests/helpers/browser-benchmarks.js';

// A single additive profession selection and shared filters must describe every benchmark view.
test('shared header combines profession toggles and retains damage and role filters across every view', async ({
  page
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/benchmarks.html?profession=elementalist');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  const professions = page.getByRole('group', { name: 'Benchmark professions' });
  const ranger = professions.getByRole('button', { name: 'Ranger', exact: true });
  const elementalist = professions.getByRole('button', { name: 'Elementalist', exact: true });
  const all = professions.getByRole('button', { name: 'All professions', exact: true });
  await ranger.press('Space');
  await expect(ranger).toHaveAttribute('aria-pressed', 'true');
  await expect(elementalist).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#benchmark-damage').selectOption('power');
  await page.locator('#benchmark-role').selectOption('quickness');
  await page.locator('#benchmark-outdated').check();
  await page.locator('#benchmark-search').fill('Power');
  for (const panel of ['builds', 'profession', 'apm', 'health']) {
    await page.locator(`[data-benchmark-panel="${panel}"]`).click();
    await expect(professions).toBeVisible();
    await expect(ranger).toHaveAttribute('aria-pressed', 'true');
    await expect(elementalist).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#benchmark-damage')).toHaveValue('power');
    await expect(page.locator('#benchmark-role')).toHaveValue('quickness');
    await expect(page.locator('#benchmark-outdated')).toBeChecked();
    await expect(page.locator('#benchmark-search')).toHaveValue('Power');
    const content = page.locator(`[data-chart-panel="${panel}"]`);
    const filters = await page.locator('.benchmark-filters').boundingBox();
    expect(filters.y + filters.height).toBeLessThanOrEqual((await content.boundingBox()).y);
    const labels = await content
      .locator('[data-bar-point], [data-point], [data-health-point]')
      .evaluateAll((points) => points.map((point) => point.getAttribute('aria-label')));

    if (panel !== 'builds') {
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.every((label) => /^(Elementalist|Ranger)/.test(label) && /Power.*Quickness/i.test(label))).toBe(
        true
      );
    }
  }

  await ranger.press('Enter');
  await expect(ranger).toHaveAttribute('aria-pressed', 'false');
  await expect(elementalist).toHaveAttribute('aria-pressed', 'true');
  await all.click();
  await expect(professions.locator('[aria-pressed="true"]')).toHaveCount(10);
  await all.press('Space');
  await expect(professions.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-health-chart]')).toContainText('No completed health bands');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(professions.locator('[aria-pressed="true"]')).toHaveCount(10);
  await expect(page.locator('#benchmark-damage')).toHaveValue('all');
  await expect(page.locator('#benchmark-role')).toHaveValue('all');
  await expect(page.locator('#benchmark-outdated')).not.toBeChecked();
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
  await selectProfessions(page, 'elementalist');
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
  await expect(table.locator('thead')).toContainText('Source');
  // Source labels fit inside their hit areas without overlapping the scrollbar.
  const bounds = await table
    .locator('.benchmark-source-link')
    .first()
    .evaluateAll((links) =>
      links.map((link) => {
        const text = document.createRange();
        text.selectNodeContents(link);
        const label = text.getBoundingClientRect();
        const button = link.getBoundingClientRect();
        return { left: button.left, right: button.right, labelLeft: label.left, labelRight: label.right };
      })
    );
  expect(bounds).toHaveLength(1);
  for (const button of bounds) {
    expect(button.labelLeft).toBeGreaterThan(button.left);
    expect(button.labelRight).toBeLessThan(button.right);
  }

  const viewportRight = await table
    .locator('.benchmark-overview-table-scroll')
    .evaluate((node) => node.getBoundingClientRect().left + node.clientWidth);
  expect(bounds[0].right).toBeLessThan(viewportRight);
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
  // Wider glyphs reproduce native-select overflow independently of the host's installed UI font.
  await page.addStyleTag({ content: '#benchmarks-view { font-family: monospace; }' });
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
  // Exercise the wider numeric font used when Consolas is unavailable on the CI host.
  await page.addStyleTag({ content: ':root { --mono: "Courier New", monospace; }' });
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
