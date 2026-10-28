import { expect, test } from '@playwright/test';

// Metric, phase, and build-scope controls keep the plot, point inspection, and sortable values table in sync.
test('health chart switches metric, phase, and scope with point inspection and sortable values', async ({ page }) => {
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
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
  // Table sorting preserves the chart and follows the selected DPS metric across mode and scope changes.
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

// Pins and whole-build highlights stay linked across chart points, table rows, filters, and responsive layouts.
// Steps run in order on one dashboard; each owns its locators and leaves no pins for the next.
test('health pins and highlights stay linked across the chart, table, filters, and layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'DPS by health', exact: true }).click();
  const chart = page.locator('[data-health-chart]');
  await test.step('side-by-side values keep the plot stationary while rows scroll and filter to pinned builds', async () => {
    await page.locator('[data-health-builds]').selectOption('all');
    const table = chart.locator('.health-values');
    const plot = chart.locator('.health-chart-scroll');
    const before = await plot.boundingBox();
    const bounds = await table.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(before.x + before.width);
    expect(Math.abs(bounds.y - before.y)).toBeLessThan(2);
    expect(before.y + before.height).toBeLessThanOrEqual(1000);
    const toggle = table.locator('[data-health-toggle]').first();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle.locator('../..')).toHaveCSS('box-shadow', 'none');
    const scroll = table.getByRole('region', { name: 'Build DPS values' });
    await scroll.hover();
    await page.mouse.wheel(0, 500);
    await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect(await plot.boundingBox()).toEqual(before);
    await table.getByRole('checkbox', { name: 'Pinned only' }).check();
    await expect(table.locator('[data-health-row]:visible')).toHaveCount(1);
    await expect(chart.locator('[data-health-point]:visible')).toHaveCount(5);
    await table.locator('[data-health-sort="20-0"]').click();
    await expect(table.getByRole('checkbox', { name: 'Pinned only' })).toBeChecked();
    await expect(table.locator('[data-health-row]:visible')).toHaveCount(1);
    await chart.locator('[data-unpin-health]').click();
    await expect(table.locator('[data-health-pinned-empty]')).toBeVisible();
    await expect(chart.locator('[data-health-point]:visible')).toHaveCount(0);
    await table.getByRole('checkbox', { name: 'Pinned only' }).uncheck();
    await expect(table.locator('[data-health-row]:visible')).not.toHaveCount(0);
    // A narrow embedded content area must stack even when the browser viewport remains wide.
    const main = page.locator('.benchmark-main');
    await main.evaluate((node) => (node.style.width = '1100px'));
    const embeddedPlot = await plot.boundingBox();
    expect((await table.boundingBox()).y).toBeGreaterThanOrEqual(embeddedPlot.y + embeddedPlot.height);
    await main.evaluate((node) => node.style.removeProperty('width'));
    const widePlot = await plot.boundingBox();
    expect((await table.boundingBox()).x).toBeGreaterThanOrEqual(widePlot.x + widePlot.width);
    for (const width of [1280, 1100, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const mobilePlot = await plot.boundingBox();
      expect((await table.boundingBox()).y).toBeGreaterThanOrEqual(mobilePlot.y + mobilePlot.height);
    }
  });
  await test.step('table rows and chart points toggle the same pin in both directions', async () => {
    // Later steps use the default top-build scope at a desktop width.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-health-builds]').selectOption('top');
    const name = await chart.locator('[data-health-toggle]').first().textContent();
    const toggle = chart.getByRole('button', { name, exact: true });
    const row = toggle.locator('../..');
    const key = await row.getAttribute('data-health-series');
    const pointName = await chart
      .locator('[data-health-point]')
      .evaluateAll(
        (points, key) => points.find((point) => point.dataset.healthSeries === key).getAttribute('aria-label'),
        key
      );
    const point = chart.getByRole('button', { name: pointName, exact: true });
    await row.locator('td').first().hover();
    await expect(row).toHaveClass(/is-health-active/);
    await expect(point).toHaveClass(/is-health-active/);
    expect(
      await chart
        .locator('.health-line')
        .evaluateAll(
          (lines, key) =>
            lines
              .filter((line) => line.dataset.healthSeries === key)
              .every((line) => line.classList.contains('is-health-active')),
          key
        )
    ).toBe(true);
    await row.locator('td').first().click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(point).toHaveAttribute('aria-pressed', 'true');
    await expect(row).toHaveClass(/is-health-pinned/);
    await expect(chart.locator('.health-pin-label')).toContainText(name);
    await chart.locator('[data-health-sort="20-0"]').click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.press('Space');
    await expect(point).toHaveAttribute('aria-pressed', 'false');
    await expect(row).not.toHaveClass(/is-health-pinned/);
    await expect(chart.locator('.health-pin-label')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(toggle).not.toBeFocused();
    await expect(point).not.toHaveClass(/is-health-active/);
    await point.focus();
    await expect(row).toHaveClass(/is-health-active/);
    await point.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await chart.getByRole('button', { name: `Unpin ${name}`, exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(row).not.toHaveClass(/is-health-active|is-health-pinned/);
    await expect(point).not.toHaveClass(/is-health-active/);
  });
  await test.step('unpinning ends emphasis instead of refocusing the point', async () => {
    const builds = await chart.locator('[data-health-point]').evaluateAll((points) =>
      [
        ...new Map(
          points.map((point) => [
            point.dataset.healthSeries,
            {
              key: point.dataset.healthSeries,
              name: point.dataset.healthName,
              label: point.getAttribute('aria-label')
            }
          ])
        ).values()
      ].slice(0, 2)
    );
    for (const build of builds) {
      await chart.getByRole('button', { name: build.label, exact: true }).focus();
      await page.keyboard.press('Enter');
    }

    await chart.getByRole('button', { name: `Unpin ${builds[0].name}`, exact: true }).click();
    await expect(chart.locator('.health-pin-label')).toHaveCount(1);
    const removedMarks = await chart.locator('.health-line, [data-health-point]').evaluateAll(
      (marks, key) =>
        marks
          .filter((mark) => mark.dataset.healthSeries === key)
          .map((mark) => ({
            active: mark.classList.contains('is-health-active'),
            muted: mark.classList.contains('is-health-muted'),
            focused: mark === document.activeElement
          })),
      builds[0].key
    );
    expect(removedMarks.length).toBeGreaterThan(0);
    for (const mark of removedMarks) expect(mark).toEqual({ active: false, muted: true, focused: false });
    await expect(chart.getByRole('button', { name: builds[1].label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await chart.getByRole('button', { name: `Unpin ${builds[1].name}`, exact: true }).press('Enter');
    await expect(chart.locator('.health-pin-label')).toHaveCount(0);
    await expect(chart.locator('.is-health-active, .is-health-muted')).toHaveCount(0);
    expect(
      await chart
        .locator('[data-health-point]')
        .evaluateAll((points) => points.some((point) => point === document.activeElement))
    ).toBe(false);
    await chart.getByRole('button', { name: builds[0].label, exact: true }).focus();
    await expect(chart.locator('.health-line.is-health-active')).not.toHaveCount(0);
  });
  await test.step('whole-build highlights and up to five non-overlapping pins survive metric and phase filters', async () => {
    // Move focus off the previously inspected point so it cannot hold a highlight.
    await page.locator('[data-health-metric]').focus();
    const builds = await chart.locator('[data-health-point]').evaluateAll((points) => {
      const unique = new Map();
      for (const point of [...points].sort((a, b) => parseFloat(b.style.bottom) - parseFloat(a.style.bottom))) {
        if (!unique.has(point.dataset.healthSeries)) {
          unique.set(point.dataset.healthSeries, {
            key: point.dataset.healthSeries,
            name: point.dataset.healthName,
            label: point.getAttribute('aria-label')
          });
        }
      }

      return [...unique.values()].slice(0, 6);
    });
    const point = chart.getByRole('button', { name: builds[0].label, exact: true });
    await point.hover();
    await expect(chart.locator('.health-line.is-health-active')).not.toHaveCount(0);
    await page.locator('[data-health-metric]').hover();
    await expect(chart.locator('.is-health-muted')).toHaveCount(0);
    await point.focus();
    expect(
      await chart
        .locator('.health-line')
        .evaluateAll(
          (lines, key) =>
            lines.every((line) =>
              line.classList.contains(line.dataset.healthSeries === key ? 'is-health-active' : 'is-health-muted')
            ),
          builds[0].key
        )
    ).toBe(true);
    await point.click();
    await expect(point).toHaveAttribute('aria-pressed', 'true');
    await expect(chart.getByRole('group', { name: 'Pinned builds' })).toContainText(builds[0].name);
    await page.keyboard.press('Escape');
    await expect(point).not.toBeFocused();
    await expect(point).toHaveClass(/is-health-active/);
    for (const build of builds.slice(1, 5)) {
      await chart.getByRole('button', { name: build.label, exact: true }).focus();
      await page.keyboard.press('Enter');
    }

    await expect(chart.locator('.health-pin-label')).toHaveCount(5);
    await chart.getByRole('button', { name: builds[5].label, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(chart.locator('[data-health-pin-status]')).toContainText('Up to 5 builds');
    await expect(chart.locator('.health-pin-label')).toHaveCount(5);
    await page.keyboard.press('Escape');
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          chart.locator('.health-pin-label').evaluateAll((labels) => {
            const boxes = labels.map((label) => label.getBoundingClientRect()).sort((a, b) => a.top - b.top);
            return boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom + 9);
          })
        )
        .toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }

    await page.locator('[data-health-metric]').selectOption('phase');
    await expect(chart.locator('.health-pin-label')).toHaveCount(5);
    await page.locator('[data-health-phase]').selectOption('40-20');
    await expect(chart.locator('.health-pin-label')).toHaveCount(5);
    await expect(chart.locator('.health-pin-connectors line')).toHaveCount(5);
    await chart.getByRole('button', { name: `Unpin ${builds[0].name}`, exact: true }).click();
    await expect(chart.locator('.health-pin-label')).toHaveCount(4);
    await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('no-such-build');
    await expect(chart.locator('.health-pin-label')).toHaveCount(0);
    await expect(chart).toContainText('No completed health bands');
  });
});
