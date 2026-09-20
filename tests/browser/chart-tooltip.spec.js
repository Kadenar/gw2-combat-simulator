import { expect, test } from '@playwright/test';

// Hover real charts at both edges to catch clipping inside chart containers and narrow viewports.
test('graph tooltips stay inside the chart at desktop and mobile widths', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountTimeSeriesCharts } = await import('/js/games/gw2/app/results/charts/time-series-view.ts');
    const { relicComparisonChartSvg, bindRelicComparisonChartHover } =
      await import('/js/games/gw2/app/simulation/relic-comparison/relic-comparison-chart.ts');
    document.body.innerHTML =
      '<main style="max-width: 1000px; margin: auto"><div id="charts"></div><div id="relic"></div></main>';
    mountTimeSeriesCharts(
      document.querySelector('#charts'),
      {
        durationMs: 10000,
        dps: [
          { t: 0, v: 30000 },
          { t: 10000, v: 30000 }
        ],
        effects: {
          Might: [
            { t: 0, v: 25 },
            { t: 10000, v: 25 }
          ]
        }
      },
      { dpsLabel: 'Average DPS' }
    );
    const model = {
      opponentRelic: 'Fractal',
      targetRelic: 'Akeem',
      durationMs: 10000,
      evaluationStartMs: 0,
      opponentFinalDps: 30000,
      targetFinalDps: 29000,
      points: [
        { tMs: 0, opponentDps: 30000, targetDps: 29000 },
        { tMs: 10000, opponentDps: 30000, targetDps: 29000 }
      ]
    };
    const relic = document.querySelector('#relic');
    relic.innerHTML = relicComparisonChartSvg(model);
    bindRelicComparisonChartHover(relic, model);
  });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [chartRole, tooltipRole] of [
      ['dps-canvas', 'dps-tooltip'],
      ['effects-canvas', 'effects-tooltip'],
      ['relic-comparison-chart', 'relic-comparison-tooltip']
    ]) {
      const chart = page.locator(`[data-role="${chartRole}"]`);
      const tooltip = page.locator(`[data-role="${tooltipRole}"]`);
      const bounds = await chart.boundingBox();
      const right = bounds.width - Math.max(20, bounds.width * 0.04);
      const left = Math.max(70, bounds.width * 0.15);
      for (const x of [right, left, right]) {
        await chart.hover({ position: { x, y: bounds.height / 2 } });
        await expect(tooltip).toBeVisible();
        const boundsCheck = await tooltip.evaluate((element) => {
          const tip = element.getBoundingClientRect();
          const parent = element.parentElement.getBoundingClientRect();
          return {
            left: tip.left,
            right: tip.right,
            parentLeft: parent.left,
            parentRight: parent.right,
            viewport: innerWidth,
            content: element.scrollWidth,
            width: element.clientWidth
          };
        });
        expect(boundsCheck.left).toBeGreaterThanOrEqual(boundsCheck.parentLeft);
        expect(boundsCheck.right).toBeLessThanOrEqual(boundsCheck.parentRight + 1);
        expect(boundsCheck.right).toBeLessThanOrEqual(boundsCheck.viewport);
        expect(boundsCheck.content).toBeLessThanOrEqual(boundsCheck.width);
      }
    }
  }
});
