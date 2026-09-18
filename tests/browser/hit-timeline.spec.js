import { expect, test } from '@playwright/test';

// Pulse state belongs beside individual strikes, without an extra strip or labels on condition payouts.
test('skill details distinguish normal and empowered applications', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountRotationResults, SKILL_COLS } = await import('/js/games/gw2/app/results/analysis-panel.ts');
    document.body.innerHTML = '<div id="series"></div>';
    mountRotationResults(document.querySelector('#series'), {
      showSummary: false,
      skillColumns: SKILL_COLS,
      skillRows: [
        {
          key: 'embrace',
          name: 'Embrace the Darkness',
          sourceSkill: 'Embrace the Darkness',
          group: 'Player',
          total: 100
        },
        { key: 'other', name: 'Other Skill', sourceSkill: 'Other Skill', group: 'Player', total: 100 }
      ],
      chartSeries: {
        durationMs: 8000,
        dps: [
          { t: 0, v: 0 },
          { t: 8000, v: 100 }
        ],
        cumulativeDamage: [
          { t: 0, v: 0 },
          { t: 8000, v: 400 }
        ],
        effects: {},
        skillDamage: {
          embrace: [
            ...[0, 1000, 2000, 3000, 3500, 6000].map((t) => ({ t, v: 100 })),
            ...[1000, 2000].map((t) => ({ t, v: 20, damageType: 'condition', conditionType: 'Torment' }))
          ],
          other: [
            { t: 0, v: 100 },
            { t: 1000, v: 100 }
          ]
        },
        skillNames: { embrace: 'Embrace the Darkness', other: 'Other Skill' },
        skillApplications: {
          'Embrace the Darkness': [0, 1000, 2000, 3000, 6000].map((t) => ({
            t,
            label: 'Embrace the Darkness',
            empowered: t === 1000 || t === 6000
          }))
        }
      }
    });
  });
  const embraceRow = page.locator('[data-skill-key="embrace"]');
  const otherRow = page.locator('[data-skill-key="other"]');
  await embraceRow.focus();
  await embraceRow.press('Enter');
  const timeline = page.locator('[data-role="skill-timeline"]');
  const strikes = timeline.getByRole('group', { name: 'Strike damage', exact: true });
  await strikes.getByRole('button', { name: '0.00s · 5 hits', exact: true }).click();
  await expect(strikes.getByRole('columnheader', { name: 'Pulse', exact: true })).toBeVisible();
  await expect(strikes.locator('tbody tr td:last-child')).toHaveText(['Normal', 'Empowered', 'Normal', 'Normal', '—']);
  await expect(page.locator('[data-role="skill-applications"]')).toHaveCount(0);
  await expect(page.getByText('Hover or focus a pulse for its application time.')).toHaveCount(0);
  await strikes.getByRole('img', { name: '6.00s · 1 hit', exact: true }).focus();
  await expect(strikes.locator('[data-role="hit-timeline-tooltip"]')).toContainText('Pulse: Empowered');
  const conditions = timeline.getByRole('group', { name: 'Condition damage', exact: true });
  await conditions.getByRole('button').click();
  await expect(conditions.getByRole('columnheader', { name: 'Pulse', exact: true })).toHaveCount(0);
  await timeline.screenshot({ path: testInfo.outputPath('skill-pulse-details.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(strikes.getByRole('cell', { name: 'Empowered', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await timeline.screenshot({ path: testInfo.outputPath('skill-pulse-details-mobile.png') });
  await embraceRow.click();
  await expect(timeline).toHaveCount(0);
  await otherRow.click();
  await timeline.getByRole('button', { name: '0.00s · 2 hits', exact: true }).click();
  await expect(timeline.getByRole('columnheader', { name: 'Pulse', exact: true })).toHaveCount(0);
});

// Condition rows disclose actual payouts and application shares using the existing keyboard-accessible inspector.
test('condition rows inspect full and partial payouts across sources', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountRotationResults } = await import('/js/games/gw2/app/results/analysis-panel.ts');
    const { buildTimeSeries } = await import('/js/games/gw2/app/results/charts/time-series-model.ts');
    const chartSeries = buildTimeSeries({
      dpsStartTime: 0.36,
      duration: 6.36,
      resolvedEvents: [
        {
          type: 'condition',
          condition: 'Torment',
          name: 'Player skill',
          actorType: 'player',
          at: 0.36,
          stacks: 2,
          damageTicks: [
            { at: 1.36, damage: 200, fraction: 1 },
            { at: 2.36, damage: 418, fraction: 0.56 },
            { at: 6.36, damage: 50, fraction: 0.25 }
          ]
        },
        {
          type: 'condition',
          condition: 'Torment',
          name: 'Clone <Bolt>',
          actorType: 'summon',
          summonKind: 'clone',
          at: 1.32,
          stacks: 1,
          damageTicks: [
            { at: 1.36, damage: 4, fraction: 0.04 },
            { at: 2.36, damage: 317, fraction: 0.28 }
          ]
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          name: 'Other skill',
          at: 0.36,
          stacks: 1,
          damageTicks: [
            { at: 1.36, damage: 10, fraction: 1 },
            { at: 2.36, damage: 10, fraction: 1 },
            { at: 6.36, damage: 1, fraction: 0.04 }
          ]
        }
      ]
    });
    document.body.innerHTML = '<div id="results"></div>';
    mountRotationResults(document.querySelector('#results'), {
      showSummary: false,
      chartSeries,
      conditions: [
        { name: 'Torment', damage: 989, dps: 989 / 6, averageStacks: 1 },
        { name: 'Bleeding', damage: 21, dps: 21 / 6, averageStacks: 1 },
        { name: 'Crippled', damage: 0, dps: 0, averageStacks: 1 }
      ]
    });
  });
  const torment = page.getByRole('button', { name: 'Inspect Torment ticks', exact: true });
  await torment.focus();
  await torment.press('Enter');
  await expect(torment).toHaveAttribute('aria-expanded', 'true');
  const inspector = page.getByRole('dialog', { name: 'Torment damage inspector' });
  await expect(inspector).toBeVisible();
  expect((await inspector.boundingBox()).width).toBeGreaterThan(1000);
  const timeline = page.getByRole('region', { name: 'Torment damage ticks' });
  // The complete ledger opens by default and includes payouts beyond the first chart window.
  await expect(timeline.getByRole('button', { name: 'All ticks', exact: true })).toHaveCount(0);
  await expect(timeline.getByRole('button', { name: 'Clear time selection' })).toHaveCount(0);
  // Totals combine simultaneous partial applications, retaining stack counts and their already-rounded damage.
  const view = timeline.getByRole('combobox', { name: 'View', exact: true });
  const totals = timeline.getByRole('table', { name: 'Combined condition payouts' });
  await expect(totals.locator('tbody tr')).toHaveCount(3);
  await expect(totals.locator('tbody tr').nth(0).locator('th, td')).toHaveText(['1.00s', '2', '200', '1', '4', '204']);
  await expect(totals.locator('tbody tr').nth(1).locator('th, td')).toHaveText(['2.00s', '0', '0', '3', '735', '735']);
  await expect(totals.locator('tbody tr').nth(2).locator('th, td')).toHaveText(['6.00s', '0', '0', '2', '50', '50']);
  await expect(timeline.locator('.condition-payouts')).toHaveCount(0);
  await inspector.screenshot({ path: testInfo.outputPath('condition-tick-totals.png') });
  await view.selectOption('sources');
  await expect(timeline.locator('.condition-payouts > details')).toHaveCount(3);
  await expect(timeline.locator('.condition-payouts > details').last().locator('summary')).toContainText(
    'Damage dealt at 6.00s · 50 damage'
  );
  await expect(timeline.locator('.hit-detail-header')).toContainText('All ticks · 3 ticks · 989 damage');
  await inspector.screenshot({ path: testInfo.outputPath('condition-all-ticks.png') });
  const window = timeline.getByRole('button', { name: '0.00s–5.00s · 2 ticks', exact: true });
  await window.hover();
  const tooltip = timeline.locator('[data-role="hit-timeline-tooltip"]').first();
  await expect(tooltip).toContainText('Total damage: 939');
  const tooltipBounds = await tooltip.boundingBox();
  const bodyBounds = await inspector.locator('.condition-inspector-body').boundingBox();
  expect(tooltipBounds.y + tooltipBounds.height).toBeLessThanOrEqual(bodyBounds.y + bodyBounds.height);
  await inspector.screenshot({ path: testInfo.outputPath('condition-tooltip.png') });
  await window.click();
  const details = timeline.locator('[data-role="hit-detail"]');
  const payoutRows = details.locator('.condition-payouts > details');
  await expect(payoutRows).toHaveCount(2);
  await expect(window).toHaveAttribute('aria-expanded', 'true');
  await expect(payoutRows.first().locator('summary')).toContainText('Damage dealt at 1.00s · 204 damage');
  const attribution = payoutRows.first();
  await attribution.locator('summary').focus();
  await attribution.locator('summary').press('Space');
  await expect(attribution).toHaveAttribute('open', '');
  await expect(attribution.locator('tbody tr').first().locator('td')).toHaveText([
    'Player skill',
    'player',
    '0.00s',
    '1.00s',
    '2',
    'Full · 1000ms',
    '200'
  ]);
  await expect(attribution.locator('tbody tr').last().locator('td')).toHaveText([
    'Clone <Bolt>',
    'clone',
    '0.96s',
    '1.00s',
    '1',
    'Partial · 40ms',
    '4'
  ]);
  const table = attribution.locator('.condition-attribution-table');
  expect(await table.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  await inspector.screenshot({ path: testInfo.outputPath('condition-attribution.png') });
  await resizeToMobile(page);
  await expect(attribution).toHaveAttribute('open', '');
  expect((await inspector.boundingBox()).width).toBeLessThanOrEqual(390);
  const inspectorBody = inspector.locator('.condition-inspector-body');
  expect(await inspectorBody.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  await inspector.screenshot({ path: testInfo.outputPath('condition-attribution-mobile.png') });
  // Toggling the selected window restores all payouts without changing the selected view.
  await window.focus();
  await window.press('Enter');
  await expect(window).toHaveAttribute('aria-expanded', 'false');
  await expect(payoutRows).toHaveCount(3);
  await expect(timeline.locator('.hit-detail-header')).toContainText('989 damage');
  await view.selectOption('totals');
  await expect(totals.locator('tbody tr')).toHaveCount(3);
  await window.click();
  await expect(totals.locator('tbody tr')).toHaveCount(2);
  await timeline.getByRole('button', { name: 'Clear time selection' }).click();
  await expect(totals.locator('tbody tr')).toHaveCount(3);
  await expect(window).toBeFocused();
  expect(await inspectorBody.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  await inspector.screenshot({ path: testInfo.outputPath('condition-tick-totals-mobile.png') });
  await inspector.getByRole('button', { name: 'Close condition inspector', exact: true }).click();
  await expect(torment).toBeFocused();
  const bleeding = page.getByRole('button', { name: 'Inspect Bleeding ticks', exact: true });
  await bleeding.click();
  await expect(torment).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Torment damage ticks' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Bleeding damage ticks' })).toBeVisible();
  const bleedingInspector = page.getByRole('dialog', { name: 'Bleeding damage inspector' });
  await bleedingInspector.getByRole('combobox', { name: 'View', exact: true }).selectOption('sources');
  const single = bleedingInspector.getByRole('button', { name: '5.00s–6.00s · 1 tick', exact: true });
  await single.click();
  await expect(bleedingInspector.locator('.condition-payouts')).toContainText('0 full · 1 partial');
  await bleedingInspector.getByRole('button', { name: 'Clear time selection', exact: true }).press('Escape');
  await expect(bleedingInspector).toBeVisible();
  await expect(bleedingInspector.locator('.condition-payouts > details')).toHaveCount(3);
  await expect(single).toBeFocused();
  await single.press('Escape');
  await expect(bleeding).toBeFocused();
  await expect(bleeding).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-role="condition-timeline"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect Crippled ticks' })).toHaveCount(0);
});

// Sample the resize event before observers redraw controls so transient desktop geometry cannot escape the chart.
async function resizeToMobile(page) {
  await page.evaluate(() => {
    window.resizeOverflow = null;
    window.addEventListener(
      'resize',
      () => {
        window.resizeOverflow = document.documentElement.scrollWidth - innerWidth;
      },
      { once: true }
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => window.resizeOverflow)).toBe(0);
}

// Window controls retain precise ticks in both placements, including clipped phases and narrow screens.
test('conditions use separate bounded windows with accessible tick details', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountHitTimeline } = await import('/js/ui/results/charts/hit-timeline-view.ts');
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
        damageType: 'condition',
        conditionType: 'Bleeding'
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
    const singleStrike = strikes.getByRole('img', { name: '9.10s · 1 hit', exact: true });
    await singleStrike.focus();
    await expect(strikes.locator('[data-role="hit-timeline-tooltip"]')).toContainText('Critical: Yes');
    const strike = strikes.getByRole('button', { name: '0.10s · 2 hits', exact: true });
    await strike.click();
    await expect(strikes.locator('tbody tr')).toHaveCount(2);
    await strikes.getByRole('button', { name: 'Close hit details' }).click();
    const window = conditions.getByRole('button', { name: '5.00s–10.00s · 5 ticks', exact: true });
    await conditions.locator('canvas').hover({ position: { x: 1, y: 1 } });
    await window.focus();
    const tooltip = conditions.locator('[data-role="hit-timeline-tooltip"]');
    await expect(tooltip).toContainText('Total damage: 50');
    // Pointer events, including those caused by scrolling, must preserve the keyboard-focused window's tooltip.
    const lastWindow = conditions.getByRole('button', { name: '10.00s–12.00s · 2 ticks', exact: true });
    await lastWindow.hover();
    await expect(window).toBeFocused();
    await expect(tooltip).toContainText('Total damage: 50');
    await conditions.locator('canvas').hover({ position: { x: 1, y: 1 } });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Total damage: 50');
    await strike.focus();
    await lastWindow.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Total damage: 20');
    await window.focus();
    await expect(tooltip).toContainText('Total damage: 50');
    await window.press('Enter');
    const detail = conditions.locator('[data-role="hit-detail"]');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('columnheader', { name: 'Tick', exact: true })).toBeVisible();
    await expect(detail.getByRole('columnheader', { name: 'Critical', exact: true })).toHaveCount(0);
    await expect(detail.locator('tbody tr')).toHaveCount(5);
    await expect(detail.locator('tbody tr').first().locator('td')).toHaveText(['1', '5.00s', 'Bleeding', '10']);
    await expect(detail.locator('tbody tr').last().locator('td')).toHaveText(['5', '9.00s', 'Bleeding', '10']);
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
  await resizeToMobile(page);
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
  await expect(phase.locator('tbody tr').first().locator('td')).toHaveText(['1', '3.00s', 'Bleeding', '10']);
  await phase.getByRole('button', { name: '5.00s–8.80s · 4 ticks', exact: true }).click();
  await expect(phase.locator('tbody tr')).toHaveCount(4);
});

// Condition labels survive projection, and only identical timestamps and types combine across applications.
test('condition details sum simultaneous ticks by type', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountHitTimeline } = await import('/js/ui/results/charts/hit-timeline-view.ts');
    const { buildTimeSeries } = await import('/js/games/gw2/app/results/charts/time-series-model.ts');
    const series = buildTimeSeries(
      {
        duration: 5,
        resolvedEvents: [
          { type: 'condition', condition: 'Bleeding', at: 0, damageTicks: [{ at: 1, damage: 10 }] },
          { type: 'condition', condition: 'Poisoned', at: 0, damageTicks: [{ at: 1, damage: 20 }] },
          { type: 'condition', condition: 'Bleeding', at: 0.5, damageTicks: [{ at: 1, damage: 30 }] },
          { type: 'condition', condition: 'Bleeding', at: 1.001, damage: 5 }
        ]
      },
      250,
      { skillKey: () => 'skill' }
    );
    document.body.innerHTML = '<div id="timeline"></div>';
    mountHitTimeline(document.querySelector('#timeline'), series.skillDamage.skill, { durationMs: series.durationMs });
  });
  await page.getByRole('button', { name: '0.00s–5.00s · 4 ticks', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Condition type', exact: true })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('td')).toHaveText(['1', '1.00s', 'Bleeding', '40']);
  await expect(rows.nth(1).locator('td')).toHaveText(['2', '1.00s', 'Poisoned', '20']);
  await expect(rows.nth(2).locator('td')).toHaveText(['3', '1.00s', 'Bleeding', '5']);
});

// Both chart placements share native cast controls, detailed hits, and absolute timestamps after phase changes.
test('multi-hit groups support hover, keyboard inspection, resizing, and phase changes', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountHitTimeline } = await import('/js/ui/results/charts/hit-timeline-view.ts');
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
    await detail.getByRole('button', { name: 'Close hit details' }).click();
    // Single-hit markers retain hover and keyboard information without opening a redundant detail panel.
    const single = chart.getByRole('img', { name: '13.00s · 1 hit', exact: true });
    await expect(chart.getByRole('button', { name: '13.00s · 1 hit', exact: true })).toHaveCount(0);
    await expect(single).toHaveCSS('cursor', 'default');
    await single.focus();
    await expect(tooltip).toContainText('Total damage: 50');
    await single.click();
    await expect(detail).toBeHidden();
    await single.press('Enter');
    await expect(detail).toBeHidden();
    await single.press('Space');
    await expect(detail).toBeHidden();
    await group.focus();
    await group.press('Tab');
    await expect(single).toBeFocused();
    await single.press('Escape');
    await single.evaluate((element) => element.blur());
    await single.hover();
    await expect(tooltip).toContainText('Total damage: 50');
  }

  await page.locator('#standalone').getByRole('button', { name: '5.51s · 5 hits', exact: true }).click();
  await page.locator('#standalone').screenshot({ path: testInfo.outputPath('hit-burst.png') });
  await resizeToMobile(page);
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
