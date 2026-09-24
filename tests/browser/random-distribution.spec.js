import { expect, test } from '@playwright/test';

// The chart exposes percentile data and remains readable for clustered or identical outcomes.
test('RNG range and impact table fit the workspace without a percentile table', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // This supplied-data layout needs the results styles, not a profession simulation.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="rotation-results"></div>';
  });
  const render = async (equal = false) => {
    await page.evaluate(async (equal) => {
      const { mountRotationResults } = await import('/js/games/gw2/app/results/analysis-panel.ts');
      mountRotationResults(
        document.querySelector('#rotation-results'),
        {
          showSummary: false,
          randomDistributionRequested: true,
          randomDistribution: {
            trials: 500,
            mean: equal ? 0 : 42407,
            p01: equal ? 0 : 42155,
            p10: equal ? 0 : 42257,
            p50: equal ? 0 : 42402,
            p90: equal ? 0 : 42571,
            p99: equal ? 0 : 42681,
            explanation: {
              cohortPercent: 10,
              lowDpsMean: 42209,
              highDpsMean: 42627,
              drivers: [
                { label: 'Sword weapon strength', lowAverage: 997, highAverage: 1003, delta: 6, estimatedDpsDelta: 93 },
                {
                  label: 'Greatsword weapon strength',
                  lowAverage: 1097,
                  highAverage: 1102,
                  delta: 5,
                  estimatedDpsDelta: 54
                }
              ].map((driver) => ({ ...driver, unit: 'value', category: 'weapon-strength' }))
            }
          }
        },
        {
          onRunRandomDistribution: () => {
            window.rngRecalculated = true;
          }
        }
      );
    }, equal);
  };

  await render();
  const panel = page.locator('#rotation-results .rng-distribution');
  await expect(panel.getByRole('img')).toHaveAttribute('aria-label', /Expected DPS 42,407/);
  await expect(panel.getByText('View as table')).toHaveCount(0);
  await expect(panel.getByRole('table', { name: 'Randomized DPS summary' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Recalculate' }).click();
  expect(await page.evaluate(() => window.rngRecalculated)).toBe(true);
  for (const equal of [false, true]) {
    await render(equal);
    const values = await panel.locator('.rng-marker-value').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
      })
    );
    for (let index = 0; index < values.length; index++) {
      for (const other of values.slice(index + 1)) {
        const value = values[index];
        expect(
          value.right <= other.x || other.right <= value.x || value.bottom <= other.y || other.bottom <= value.y
        ).toBe(true);
      }
    }

    await expect(panel).not.toContainText(/NaN|Infinity/);
  }

  await render();
  await page.setViewportSize({ width: 700, height: 1000 });
  for (const selector of ['.rng-chart-scroll', '.rng-table-scroll']) {
    const bounds = await panel.locator(selector).last().boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(700);
  }
});
