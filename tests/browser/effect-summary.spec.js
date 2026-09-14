import { expect, test } from '@playwright/test';

// A real mount verifies that exact summaries survive the chart adapter and stay explicitly scoped during zoom.
test('effect summaries show generation separately from uptime and stay readable on narrow screens', async ({
  page
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { buildChartSeries } = await import('/js/games/gw2/app/results/model.ts');
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    const resolvedAudience = {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    };
    const series = buildChartSeries({
      duration: 60,
      alliedPlayerCount: 0,
      resolvedEvents: [
        { type: 'buff', kind: 'alacrity', at: -1, duration: 30, audience: { recipients: 'party' }, resolvedAudience },
        { type: 'buff', kind: 'quickness', at: 0, duration: 60, resolvedAudience },
        {
          type: 'buff',
          kind: 'quickness',
          at: 40,
          duration: 15,
          audience: { recipients: 'party' },
          resolvedAudience
        },
        {
          type: 'buff',
          kind: 'might',
          at: 0,
          duration: 30,
          stacks: 25,
          audience: { recipients: 'party' },
          resolvedAudience
        },
        { type: 'buff', kind: 'fury', at: 0, duration: 30, resolvedAudience },
        { type: 'buff', kind: 'resolution', at: 0, duration: 15, resolvedAudience },
        { type: 'buff', kind: 'ashes-of-the-just', at: 0, duration: 2, resolvedAudience },
        { type: 'buff', kind: 'bad"><img src=x>', at: 0, duration: 2, resolvedAudience }
      ],
      procSteps: [{ type: 'relic_proc', skill: 'Relic of Fireworks', start: 0, expiresAt: 30000 }]
    });
    document.body.innerHTML = '<main style="max-width: 1000px; margin: auto"><div id="charts"></div></main>';
    mountTimeSeriesCharts(document.querySelector('#charts'), series, {
      healthBreakpoints: [{ healthPercent: 80, elapsed: 20, damage: 1 }]
    });
  });
  const summary = page.locator('[data-role="effect-summary"]');
  const quickness = summary
    .getByRole('region', { name: 'Boons & relics' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Quickness', exact: true }) });
  await expect(quickness).toContainText('75.0%');
  await expect(quickness).toContainText('125.0%');
  await expect(quickness).toContainText('+25.0% over target');
  await expect(quickness).toContainText('Self-only: 60.00 · Shared: 15.00');
  await expect(quickness).toContainText('Allies: 25.0%');
  await expect(summary.getByRole('region', { name: 'Allied boon generation' })).toHaveCount(0);
  const primary = summary.getByRole('region', { name: 'Boons & relics' });
  await expect(primary.getByRole('rowheader')).toHaveText([
    'Might',
    'Fury',
    'Protection',
    'Quickness',
    'Relic of Fireworks'
  ]);
  await expect(primary.getByRole('columnheader')).toHaveCount(4);
  const might = primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Might', exact: true }) });
  await expect(might).toContainText('At 25 stacks: 50.0%');
  await expect(might).not.toContainText('Self-only:');
  await expect(
    primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Fury', exact: true }) })
  ).not.toContainText('Shared:');
  await expect(summary).not.toContainText('Ashes Of The Just');
  const other = summary.locator('[data-role="supplementary-boons"]');
  await expect(other).not.toHaveAttribute('open');
  await expect(other.locator('caption')).toHaveCount(0);
  await other.locator('summary').click();
  const resolution = other
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Resolution', exact: true }) });
  await expect(resolution.getByRole('cell')).toHaveText(['25.0%', '15.00', '25.0%']);
  await other.locator('summary').click();
  await expect(summary.locator('img')).toHaveCount(0);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(primary.locator('caption')).toHaveText('Boons & relics · full benchmark (60.00s)');
  await expect(quickness).toContainText('125.0%');
  await summary.screenshot({ path: testInfo.outputPath('effect-summary-desktop.png') });
  await expect(summary.locator('[data-role="effect-summary-help"]')).toHaveCount(0);
  await expect(summary).not.toContainText('Before window');
  await expect(summary.getByRole('rowheader', { name: 'Alacrity', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await summary.screenshot({ path: testInfo.outputPath('effect-summary-mobile.png') });
});
