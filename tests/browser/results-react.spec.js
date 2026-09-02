import { expect, test } from '@playwright/test';

async function openProfession(page, profession = 'elementalist') {
  await page.goto(`/${profession}.html`);
  await page.waitForFunction(() => Boolean(window.professionApp?.results));
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#rotation-palette .pal-skill').first()).toBeVisible();
}

test('analysis results sort, select damage events, draw charts, and open loop details', async ({ page }) => {
  await openProfession(page, 'mesmer');
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(
    () =>
      window.professionApp.build.rotation.length > 0 &&
      !['queued', 'running'].includes(window.professionApp.simulationStatus)
  );
  expect(await page.evaluate(() => window.professionApp.simulationError)).toBe('');
  await page.getByRole('link', { name: 'Analysis' }).click();

  await expect(page.locator('.analysis-dps-summary .res-summary')).toBeVisible();
  await expect(page.getByText('Damage Breakdown', { exact: true })).toBeVisible();
  await expect(page.locator('[data-role="result-charts"] canvas').first()).toBeVisible();

  const dpsHeader = page.locator('[data-role="skill-header"] [data-sort-col="dps"]');
  await dpsHeader.click();
  await expect(dpsHeader).toContainText('▼');

  const damageRow = page.locator('[data-role="skill-rows"] [data-skill-key]').first();
  await damageRow.click();
  await expect(damageRow).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-role="skill-timeline"] canvas')).toBeVisible();

  const loopLauncher = page.getByRole('button', { name: /Rotation Pattern/ });
  if (await loopLauncher.isVisible()) {
    await loopLauncher.click();
    await expect(page.getByRole('dialog', { name: 'Rotation Pattern' })).toBeVisible();
    await page.getByRole('button', { name: 'Close rotation pattern' }).click();
    await expect(page.getByRole('dialog', { name: 'Rotation Pattern' })).toHaveCount(0);
  }
});

test('result progress, errors, warnings, and event-log controls update through React roots', async ({ page }) => {
  await openProfession(page);
  await page.evaluate(async () => {
    const resultsHost = document.body.appendChild(document.createElement('div'));
    resultsHost.id = 'phase2-results-host';
    const warningsHost = document.body.appendChild(document.createElement('div'));
    warningsHost.id = 'phase2-warnings-host';
    const eventLogHost = document.body.appendChild(document.createElement('div'));
    eventLogHost.id = 'phase2-event-log-host';
    window.phase2Runs = 0;

    const [{ mountRotationResults }, { mountRotationWarnings }, { mountEventLog }] = await Promise.all([
      import('/js/games/gw2/app/presentation/results/rotation-results.tsx'),
      import('/js/ui/results/rotation-warnings.tsx'),
      import('/js/games/gw2/app/presentation/results/event-log.tsx')
    ]);
    window.mountPhase2Results = (model) =>
      mountRotationResults(resultsHost, model, {
        onRunRandomDistribution: () => {
          window.phase2Runs += 1;
        }
      });
    window.mountPhase2Results({
      metrics: [{ label: 'Player <DPS>', value: '1,234', className: 'dps' }],
      skillColumns: [
        { key: 'name', label: 'Skill' },
        { key: 'dps', label: 'DPS', numeric: true },
        { key: 'total', label: 'Total', numeric: true }
      ],
      skillRows: [
        { key: 'low', name: 'Low', dps: 10, total: 10 },
        { key: 'high', name: 'High', dps: 20, total: 20 }
      ],
      randomDistributionRequested: true,
      randomDistributionTrials: 500,
      contributionsStale: true,
      relicComparisonAvailable: true,
      relicComparisonStale: true
    });
    window.mountPhase2Warnings = (warnings) => mountRotationWarnings(warningsHost, warnings);
    window.mountPhase2Warnings([{ time: '1.25s', message: 'Unsafe <script>' }]);
    mountEventLog(
      eventLogHost,
      [
        { at: 0, type: 'one', description: 'Keep <safe>', keep: true },
        { at: 1, type: 'two', description: 'Drop me', keep: false }
      ],
      {
        initiallyOpen: true,
        filename: 'custom.csv',
        filters: [{ id: 'kept', label: 'Kept only', predicate: (row) => row.keep }]
      }
    );
  });

  const results = page.locator('#phase2-results-host');
  await expect(results.getByText('Player <DPS>')).toBeVisible();
  await expect(results.locator('script')).toHaveCount(0);
  await results.getByRole('button', { name: 'Calculate range' }).click();
  expect(await page.evaluate(() => window.phase2Runs)).toBe(1);

  const highRow = results.locator('[data-skill-key="high"]');
  await highRow.click();
  await expect(highRow).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() =>
    window.mountPhase2Results({
      skillColumns: [
        { key: 'name', label: 'Skill' },
        { key: 'dps', label: 'DPS', numeric: true },
        { key: 'total', label: 'Total', numeric: true }
      ],
      skillRows: [
        { key: 'low', name: 'Low', dps: 10, total: 10 },
        { key: 'high', name: 'High', dps: 20, total: 20 }
      ],
      randomDistributionRequested: true,
      randomDistributionStale: true,
      randomDistributionTrials: 500,
      randomDistributionProgress: { completed: 125, total: 500, percent: 25 },
      contributionsStale: true,
      relicComparisonAvailable: true,
      relicComparisonStale: true
    })
  );
  await expect(results.getByRole('progressbar', { name: 'Calculating randomized DPS range' })).toHaveAttribute(
    'aria-valuenow',
    '25'
  );
  await expect(results.getByText('125 / 500 simulations (25%)')).toBeVisible();
  await expect(highRow).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() =>
    window.mountPhase2Results({
      randomDistributionRequested: true,
      randomDistributionTrials: 500,
      randomDistributionError: 'Distribution <failed>',
      contributionsError: 'Contributions <failed>',
      relicComparisonAvailable: true,
      relicComparisonError: 'Relic <failed>'
    })
  );
  await expect(results.getByText('Distribution <failed>')).toBeVisible();
  await expect(results.getByText('Contributions <failed>')).toBeVisible();
  await expect(results.getByText('Relic <failed>')).toBeVisible();

  const warnings = page.locator('#phase2-warnings-host');
  await expect(warnings.getByText('Unsafe <script>')).toBeAttached();
  await warnings.locator('summary').click();
  await expect(warnings.locator('details')).toHaveAttribute('open', '');
  await expect(warnings.getByText('Unsafe <script>')).toBeVisible();
  await page.evaluate(() => window.mountPhase2Warnings([{ time: '2.50s', message: 'Still open' }]));
  await expect(warnings.locator('details')).toHaveAttribute('open', '');
  await expect(warnings.getByText('Still open')).toBeVisible();

  const eventLog = page.locator('#phase2-event-log-host');
  await expect(eventLog.getByText('Keep <safe>')).toBeVisible();
  await expect(eventLog.getByText('Drop me')).toBeVisible();
  await eventLog.getByLabel('Kept only').check();
  await expect(eventLog.getByText('Drop me')).toHaveCount(0);
  await expect(eventLog.getByRole('button', { name: 'Download CSV Log' })).toHaveAttribute(
    'data-filename',
    'custom.csv'
  );
});

test('empty and stale shell states render through the retained React entry point', async ({ page }) => {
  await openProfession(page);
  await page.getByRole('link', { name: 'Analysis' }).click();

  await expect(page.getByText('No analysis yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Workspace' }).last()).toBeVisible();
  await expect(page.locator('#rotation-dps-summary .res-summary-placeholder .res-stat')).toHaveCount(6);

  await page.evaluate(async () => {
    const { renderSimulationViewModel } = await import('/js/app/shell/result-view.tsx');
    renderSimulationViewModel(
      {
        summary: { metrics: [{ label: 'Output', value: 'queued' }] },
        workspace: null,
        analysis: null,
        analysisEmpty: { title: 'Waiting', message: 'Simulation queued.' }
      },
      { inputRevision: 2, outputRevision: 1 }
    );
  });
  await expect(page.locator('#rotation-dps-summary')).toHaveAttribute('aria-busy', '');
  await expect(page.getByText('Waiting')).toBeVisible();

  await page.evaluate(async () => {
    const { renderSimulationViewModel } = await import('/js/app/shell/result-view.tsx');
    renderSimulationViewModel(
      {
        summary: { metrics: [{ label: 'Output', value: 'ready' }] },
        workspace: null,
        analysis: null,
        analysisEmpty: { title: 'Ready', message: 'Simulation complete.' }
      },
      { inputRevision: 2, outputRevision: 2 }
    );
  });
  await expect(page.locator('#rotation-dps-summary')).not.toHaveAttribute('aria-busy', '');
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
});
