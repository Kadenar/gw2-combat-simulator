import { expect, test } from '@playwright/test';

// A real mount verifies that ally support leads the summary while personal results remain secondary during zoom.
test('effect summaries prioritize allied generation and stay readable on narrow screens', async ({
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
  await expect(quickness).not.toContainText('+25.0% over target');
  await expect(quickness).toContainText('Self: 75.00 · 60.00 self-only');
  await expect(quickness.getByRole('cell').first()).toHaveText(/^60\.0015\.00 per ally/);
  await expect(quickness.getByRole('cell').last()).toHaveText(/^25\.0%/);
  await expect(summary.getByRole('region', { name: 'Allied boon generation' })).toHaveCount(0);
  const primary = summary.getByRole('region', { name: 'Boons & relics' });
  await expect(primary.getByRole('rowheader')).toHaveText([
    'Might',
    'Fury',
    'Protection',
    'Quickness',
    'Relic of Fireworks'
  ]);
  await expect(primary.getByRole('columnheader')).toHaveText(['Effect', 'Allied stack-seconds', 'Coverage']);
  const might = primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Might', exact: true }) });
  await expect(might).toContainText('50.0% at cap');
  await expect(might.getByRole('cell').first()).toHaveText(/^3000\.00750\.00 per ally/);
  await expect(might.getByRole('cell').last()).toHaveText(/^50\.0% of cap/);
  await expect(might).not.toContainText('Self: 750.00');
  await expect(might).not.toContainText('Self: 50.0% of cap');
  await expect(might).not.toContainText('Self-only:');
  const fury = primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Fury', exact: true }) });
  await expect(fury.getByRole('cell').last()).toHaveText(/^0\.0%/);
  const relic = primary
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Relic of Fireworks', exact: true }) });
  await expect(relic.getByRole('cell').last()).toHaveText('Self uptime: 50.0%');
  await expect(relic.getByRole('cell').last().locator('small')).toHaveCount(0);
  await expect(summary).not.toContainText('Ashes Of The Just');
  const other = summary.locator('[data-role="supplementary-boons"]');
  await expect(other).not.toHaveAttribute('open');
  await expect(other.locator('caption')).toHaveCount(0);
  await other.locator('summary').click();
  const resolution = other
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Resolution', exact: true }) });
  await expect(resolution.getByRole('cell').first()).toHaveText(/^0\.000\.00 per ally/);
  await expect(resolution.getByRole('cell').last()).toHaveText(/^0\.0%/);
  await other.locator('summary').click();
  await expect(summary.locator('img')).toHaveCount(0);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(primary.locator('caption')).toHaveText('Boons & relics · 4 allies · full benchmark (60.00s)');
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
