import { expect, test } from '@playwright/test';

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
