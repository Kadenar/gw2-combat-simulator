import { expect, test } from '@playwright/test';

// Window controls retain precise ticks in both placements, including clipped phases and narrow screens.
test('conditions use separate bounded windows with accessible tick details', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountHitTimeline } = await import('/js/ui/results/charts/hit-timeline.ts');
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    document.body.innerHTML = '<div id="standalone"></div><div id="series"></div>';
    const hits = [
      { t: 100, v: 100, crit: true, activationId: 'cast:1', damageType: 'strike' },
      { t: 300, v: 200, crit: false, activationId: 'cast:1', damageType: 'strike' },
      { t: 9100, v: 100, crit: true, activationId: 'cast:2', damageType: 'strike' },
      ...Array.from({ length: 12 }, (_, index) => ({
        t: index * 1000,
        v: 10,
        crit: null,
        activationId: 'cast:1',
        damageType: 'condition'
      }))
    ];
    mountHitTimeline(document.querySelector('#standalone'), hits, { durationMs: 12_000, label: 'Damage events' });
    const chart = mountTimeSeriesCharts(
      document.querySelector('#series'),
      {
        durationMs: 12_000,
        dps: [
          { t: 0, v: 0 },
          { t: 12_000, v: 520 / 12 }
        ],
        cumulativeDamage: [
          { t: 0, v: 0 },
          { t: 12_000, v: 520 }
        ],
        effects: {},
        skillDamage: { skill: hits },
        skillNames: { skill: 'Mixed damage' }
      },
      {
        healthBreakpoints: [
          { healthPercent: 80, elapsed: 2.3, damage: 330 },
          { healthPercent: 60, elapsed: 8.8, damage: 390 }
        ]
      }
    );
    chart.setSelectedSkill('skill');
  });

  for (const selector of ['#standalone', '#series [data-role="dps-hit-strip"]']) {
    const chart = page.locator(selector);
    const strikes = chart.getByRole('group', { name: 'Strike damage', exact: true });
    const conditions = chart.getByRole('group', { name: 'Condition damage', exact: true });
    await expect(strikes.locator('.hit-group')).toHaveCount(2);
    await expect(conditions.locator('.hit-group')).toHaveCount(3);
    const strike = strikes.getByRole('button', { name: '0.10s · 2 hits', exact: true });
    await strike.click();
    await expect(strikes.locator('tbody tr')).toHaveCount(2);
    await strikes.getByRole('button', { name: 'Close hit details' }).click();
    const window = conditions.getByRole('button', { name: '5.00s–10.00s · 5 ticks', exact: true });
    await window.focus();
    await expect(conditions.locator('[data-role="hit-timeline-tooltip"]')).toContainText('Total damage: 50');
    await window.press('Enter');
    const detail = conditions.locator('[data-role="hit-detail"]');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('columnheader', { name: 'Tick', exact: true })).toBeVisible();
    await expect(detail.getByRole('columnheader', { name: 'Critical', exact: true })).toHaveCount(0);
    await expect(detail.locator('tbody tr')).toHaveCount(5);
    await expect(detail.locator('tbody tr').first().locator('td')).toHaveText(['1', '5.00s', '10']);
    await expect(detail.locator('tbody tr').last().locator('td')).toHaveText(['5', '9.00s', '10']);
    await detail.getByRole('button', { name: 'Close tick details' }).press('Escape');
    await expect(detail).toBeHidden();
    await expect(window).toBeFocused();
    await window.press('Space');
    await expect(detail).toBeVisible();
    const strikeBounds = await strikes.locator('canvas').first().boundingBox();
    const conditionBounds = await conditions.locator('canvas').first().boundingBox();
    expect(conditionBounds.x).toBe(strikeBounds.x);
    expect(conditionBounds.width).toBe(strikeBounds.width);
  }

  await page.locator('#standalone').screenshot({ path: testInfo.outputPath('condition-windows.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('#standalone').getByRole('button', { name: '5.00s–10.00s · 5 ticks', exact: true })
  ).toHaveAttribute('aria-expanded', 'true');
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.locator('#series').getByRole('button', { name: '80-60%', exact: true }).click();
  const phase = page.locator('#series [data-role="dps-hit-strip"]');
  await expect(phase.locator('[data-role="hit-lane"]')).toHaveCount(0);
  await expect(phase.locator('.hit-group')).toHaveCount(2);
  await phase.getByRole('button', { name: '2.30s–5.00s · 2 ticks', exact: true }).click();
  await expect(phase.locator('tbody tr')).toHaveCount(2);
  await expect(phase.locator('tbody tr').first().locator('td')).toHaveText(['1', '3.00s', '10']);
  await phase.getByRole('button', { name: '5.00s–8.80s · 4 ticks', exact: true }).click();
  await expect(phase.locator('tbody tr')).toHaveCount(4);
});

// Both chart placements share native cast controls, detailed hits, and absolute timestamps after phase changes.
test('multi-hit groups support hover, keyboard inspection, resizing, and phase changes', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountHitTimeline } = await import('/js/ui/results/charts/hit-timeline.ts');
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    document.body.innerHTML = '<div id="standalone"></div><div id="series"></div>';
    const hits = [
      { t: 5510, v: 100, crit: true, activationId: 'cast:1' },
      { t: 5610, v: 200, crit: false, activationId: 'cast:1' },
      { t: 6210, v: 50, crit: false, activationId: 'cast:2' },
      { t: 6810, v: 60, crit: false, activationId: 'cast:3' },
      { t: 7410, v: 70, crit: false, activationId: 'cast:4' },
      { t: 13_000, v: 50, crit: null, activationId: 'cast:5' }
    ];
    mountHitTimeline(document.querySelector('#standalone'), hits, { durationMs: 20_000, label: 'Damage events' });
    const chart = mountTimeSeriesCharts(
      document.querySelector('#series'),
      {
        durationMs: 20_000,
        dps: [
          { t: 0, v: 0 },
          { t: 20_000, v: 26.5 }
        ],
        cumulativeDamage: [
          { t: 0, v: 0 },
          { t: 20_000, v: 530 }
        ],
        effects: {},
        skillDamage: { skill: hits },
        skillNames: { skill: 'Multi-hit skill' }
      },
      {
        healthBreakpoints: [
          { healthPercent: 80, elapsed: 5, damage: 0 },
          { healthPercent: 60, elapsed: 10, damage: 480 }
        ]
      }
    );
    chart.setSelectedSkill('skill');
  });

  for (const selector of ['#standalone', '#series [data-role="dps-hit-strip"]']) {
    const chart = page.locator(selector);
    await expect(chart.getByText('Select a hit group to inspect individual hits.', { exact: true })).toHaveCount(0);
    const group = chart.getByRole('button', { name: '5.51s · 5 hits', exact: true });
    await group.hover();
    const tooltip = chart.locator('[data-role="hit-timeline-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('First hit: 5.51s');
    await expect(tooltip).toContainText('Last hit: 7.41s');
    await expect(tooltip).toContainText('Total damage: 480');
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    const detail = chart.locator('[data-role="hit-detail"]');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Close hit details' })).toHaveText('Close');
    await expect(detail.getByRole('button', { name: 'Close hit details' })).toHaveCSS('font-size', '11px');
    await expect(detail.locator('tbody td')).toHaveText([
      '1',
      '5.51s',
      '100',
      'Yes',
      '2',
      '5.61s',
      '200',
      'No',
      '3',
      '6.21s',
      '50',
      'No',
      '4',
      '6.81s',
      '60',
      'No',
      '5',
      '7.41s',
      '70',
      'No'
    ]);
    await detail.getByRole('button', { name: 'Close hit details' }).click();
    await expect(group).toBeFocused();
    await expect(detail).toBeHidden();
    await group.press('Enter');
    await expect(detail).toBeVisible();
    await group.press('Escape');
    await expect(detail).toBeHidden();
    await group.press('Space');
    await expect(detail).toBeVisible();
    await chart.getByRole('button', { name: '13.00s · 1 hit', exact: true }).click();
    await expect(detail.getByRole('columnheader', { name: 'Critical', exact: true })).toHaveCount(0);
    await expect(detail.locator('tbody td')).toHaveText(['1', '13.00s', '50']);
  }

  await page.locator('#standalone').getByRole('button', { name: '5.51s · 5 hits', exact: true }).click();
  await page.locator('#standalone').screenshot({ path: testInfo.outputPath('hit-burst.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#standalone [data-role="hit-detail"]')).toBeVisible();
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.locator('#series').getByRole('button', { name: '80-60%', exact: true }).click();
  const phaseGroup = page.locator('#series').getByRole('button', { name: '5.51s · 5 hits', exact: true });
  await expect(page.locator('#series [data-role="hit-detail"]')).toBeHidden();
  await phaseGroup.click();
  await expect(page.locator('#series [data-role="hit-detail"]')).toContainText('5.61s');
  const dpsCanvas = page.locator('#series [data-role="dps-canvas"]');
  const bounds = await dpsCanvas.boundingBox();
  await dpsCanvas.hover({ position: { x: 54 + (bounds.width - 70) / 2, y: 100 } });
  await expect(page.locator('#series [data-role="dps-tooltip"]')).toContainText('7.50s');
});
