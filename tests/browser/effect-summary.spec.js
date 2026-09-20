import { expect, test } from '@playwright/test';

// Exercise audience selection and phase cropping through the real canvas hover values.
test('boon charts switch between self, allies, and comparison without losing effect selection', async ({ page }) => {
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
      rotationEndTime: 10,
      observationEndTime: 10,
      combatEndTime: 10,
      resolvedEvents: [
        { type: 'buff', kind: 'might', at: 0, duration: 10, stacks: 20, resolvedAudience },
        {
          type: 'buff',
          kind: 'might',
          at: 0,
          duration: 10,
          stacks: 3,
          resolvedAudience: { ...resolvedAudience, includesSelf: false, alliedPlayerCount: 1 }
        },
        {
          type: 'buff',
          kind: 'stability',
          at: 0,
          duration: 10,
          stacks: 2,
          resolvedAudience: { ...resolvedAudience, includesSelf: false, alliedPlayerCount: 4, recipientCount: 4 }
        }
      ]
    });
    document.body.innerHTML = '<main style="max-width: 1000px; margin: auto"><div id="charts"></div></main>';
    mountTimeSeriesCharts(document.querySelector('#charts'), series, {
      healthBreakpoints: [{ healthPercent: 80, elapsed: 5, damage: 0 }]
    });
  });
  const audience = page.getByRole('group', { name: 'Boon audience' });
  const tooltip = page.locator('[data-role="effects-tooltip"]');
  const canvas = page.locator('[data-role="effects-canvas"]');
  const hover = async () => {
    const box = await canvas.boundingBox();
    await canvas.hover({ position: { x: box.width / 2, y: box.height / 2 } });
  };

  await page.locator('input[data-series="Stability"]').uncheck();
  await hover();
  await expect(tooltip).toContainText('Might (Self): 20');
  await expect(tooltip).not.toContainText('Allies');
  await audience.getByRole('button', { name: 'Allies', exact: true }).click();
  await hover();
  await expect(tooltip).toContainText('Might (Allies avg): 0.75');
  await expect(tooltip).not.toContainText('Self');
  await audience.getByRole('button', { name: 'Both', exact: true }).click();
  await hover();
  await expect(tooltip).toContainText('Might (Self): 20');
  await expect(tooltip).toContainText('Might (Allies avg): 0.75');
  await page.locator('[data-chart-phase="100-80"]').click();
  await hover();
  await expect(tooltip).toContainText('Might (Allies avg): 0.75');
  await expect(audience.getByRole('button', { name: 'Both', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[data-series="Stability"]')).not.toBeChecked();
  await page.locator('[data-effect-type="boon"]').getByRole('button', { name: 'All', exact: true }).click();
  await hover();
  await expect(tooltip).toContainText('Stability (Allies avg): 2');
  await expect(tooltip).not.toContainText('Stability (Self)');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(audience).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// A real mount verifies audience averages and personal buff stacks remain visible during zoom and on mobile.
test('effect summaries show average stacks and stay readable on narrow screens', async ({ page }) => {
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
      rotationEndTime: 60,
      observationEndTime: 60,
      combatEndTime: 60,
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
        { type: 'buff', kind: 'ashes-of-the-just', at: 0, duration: 2, stacks: 3, resolvedAudience },
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
    .getByRole('region', { name: 'Boons' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Quickness', exact: true }) });
  await expect(quickness).toContainText('75.0%');
  await expect(quickness).toContainText('125.0%');
  await expect(quickness).not.toContainText('+25.0% over target');
  await expect(quickness.getByRole('cell').first()).toHaveText('Ally: 0.25Self: 0.75');
  await expect(quickness.getByRole('cell').last()).toHaveText(/^25\.0%/);
  await expect(summary.getByRole('region', { name: 'Allied boon generation' })).toHaveCount(0);
  const primary = summary.getByRole('region', { name: 'Boons' });
  await expect(primary.getByRole('rowheader')).toHaveText(['Might', 'Fury', 'Protection', 'Quickness']);
  await expect(primary.getByRole('columnheader')).toHaveText(['Effect', 'Average stacks', 'Coverage']);
  const might = primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Might', exact: true }) });
  await expect(might).toContainText('50.0% at cap');
  await expect(might.getByRole('cell').first()).toHaveText('Ally: 12.50Self: 12.50');
  await expect(might.getByRole('cell').last()).toHaveText(/^50\.0% of cap/);
  await expect(might).not.toContainText('Self: 50.0% of cap');
  await expect(might).not.toContainText('Self-only:');
  const fury = primary.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Fury', exact: true }) });
  await expect(fury.getByRole('cell').first()).toHaveText('Ally: 0.00Self: 0.50');
  await expect(fury.getByRole('cell').last()).toHaveText(/^0\.0%/);
  await expect(summary).toContainText('Ashes Of The Just');
  const other = summary.locator('[data-role="supplementary-boons"]');
  await expect(other).not.toHaveAttribute('open');
  await expect(other.locator('summary')).toHaveText('Other boons (1)');
  await expect(other.locator('caption')).toHaveCount(0);
  await other.locator('summary').click();
  const resolution = other
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Resolution', exact: true }) });
  await expect(resolution.getByRole('cell').first()).toHaveText('Ally: 0.00Self: 0.25');
  await expect(resolution.getByRole('cell').last()).toHaveText(/^0\.0%/);
  await other.locator('summary').click();
  const buffs = summary.locator('[data-role="supplementary-buffs"]');
  await expect(buffs.locator('summary')).toHaveText('Other buffs (3)');
  await buffs.locator('summary').click();
  await expect(buffs.getByRole('columnheader')).toHaveText(['Effect', 'Average stacks', 'Player uptime']);
  await expect(buffs.getByRole('rowheader')).toHaveText([
    'Ashes Of The Just',
    'Bad"><img src=x>',
    'Relic of Fireworks'
  ]);
  await expect(buffs.getByRole('cell')).toHaveText(['0.10', '3.3%', '0.03', '3.3%', '0.50', '50.0%']);
  await expect(summary.locator('img')).toHaveCount(0);
  await page.locator('[data-chart-phase="100-80"]').click();
  await expect(primary.locator('caption')).toHaveText('Boons · 4 allies · full benchmark (60.00s)');
  await expect(quickness).toContainText('125.0%');
  await expect(quickness.getByRole('cell').first()).toHaveText('Ally: 0.25Self: 0.75');
  await expect(summary.locator('[data-role="effect-summary-help"]')).toHaveCount(0);
  await expect(summary).not.toContainText('Before window');
  await expect(summary.getByRole('rowheader', { name: 'Alacrity', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
