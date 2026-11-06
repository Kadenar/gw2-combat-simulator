import { expect, test } from '@playwright/test';

// Prepared jobs load their engine without browser UI imports, reusing the worker across selected patch versions.
test('simulation workers load current and preview patches without UI dependencies', async ({ page, context }) => {
  const patchId = 'worker-preview';
  await context.route('**/integrations/patches/active-preview.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const activePatchPreview = ${JSON.stringify({ id: patchId, label: 'Worker preview' })};`
    })
  );
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate((patchId) => {
    window.professionApp.patch = window.professionApp.profession.resolvePatch({ id: patchId });
    // Worker requests carry the canonical skill ID independently of the palette label.
    window.professionApp.addRotation('Bladecall', { skillId: 69311 });
  }, patchId);
  await page.waitForFunction(
    () => window.professionApp.analysis.state.buildRevision === window.professionApp.analysis.state.resultRevision
  );

  const uiImports = (worker) =>
    worker.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) =>
          /\/app\/(?:define-profession-app\.|build-editor\.|build\/|optimizer\/|rotation\/|results\/)/.test(url)
        )
    );

  const baselineWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('/simulation/baseline/worker.')
  );
  const baseline = await page.evaluate(() => {
    const app = window.professionApp;
    const previewRequest = app.adapter.baselineSimulationRequest(app);
    app.patch = app.profession.resolvePatch({ id: 'current' });
    const liveRequest = app.adapter.baselineSimulationRequest(app);
    app.patch = app.profession.resolvePatch({ id: previewRequest.selectedPatchId });
    return new Promise((resolve, reject) => {
      let liveOutput;
      const worker = new Worker('/js/games/gw2/app/simulation/baseline/worker.ts', {
        type: 'module'
      });
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else if (data.requestId === 1) worker.postMessage({ requestId: 2, request: liveRequest });
        else if (data.requestId === 2) {
          liveOutput = data.output;
          worker.postMessage({ requestId: 3, request: previewRequest });
        } else resolve({ ...data, liveOutput });
      });
      // Warmup loads the same engine as the actual job without publishing a simulated result.
      worker.postMessage({ requestId: 1, request: liveRequest, warmup: true });
    });
  });
  expect(baseline.requestId).toBe(3);
  expect(baseline.output.result.totalDamage).toBeGreaterThan(0);
  expect(baseline.output.result.warnings).toEqual([]);
  // Live and preview are separate jobs, each publishing just the requested result.
  expect(baseline.liveOutput.result.totalDamage).toBeGreaterThan(0);
  expect(baseline.liveOutput.result.warnings).toEqual([]);
  expect(await uiImports(await baselineWorkerReady)).toEqual([]);

  const modifierWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('/simulation/modifier-contributions/worker.')
  );
  const contributions = await page.evaluate((baselineDps) => {
    const app = window.professionApp;
    app.modifierContributionRunner.cancel();
    const { gameId, contentId, rotation, comparisons } = app.adapter.modifierContributionRequest(app, baselineDps);
    const request = { gameId, contentId, rotation, comparisons };
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/modifier-contributions/worker.ts', {
        type: 'module'
      });
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      });
      worker.postMessage({ requestId: 17, request });
    });
  }, baseline.output.result.dps);
  expect(contributions.requestId).toBe(17);
  expect(contributions.scores.length).toBeGreaterThan(0);
  expect(baseline.output.result.dps).toBeGreaterThan(0);
  expect(contributions.scores.some(({ dpsWithoutModifier }) => dpsWithoutModifier < baseline.output.result.dps)).toBe(
    true
  );
  expect(await uiImports(await modifierWorkerReady)).toEqual([]);

  const randomWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('/simulation/random-distribution/worker.')
  );
  const random = await page.evaluate(() => {
    const app = window.professionApp;
    const request = { ...app.adapter.randomDistributionRequest(app), trials: 2 };
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/random-distribution/worker.ts', {
        type: 'module'
      });
      const progress = [];
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else if (data.progress) progress.push(data.progress.completed);
        else resolve({ requestId: data.requestId, outcomes: data.outcomes, progress });
      });
      worker.postMessage({ requestId: 1, request });
    });
  });
  expect(random.requestId).toBe(1);
  expect(random.progress[0]).toBe(0);
  expect(random.progress.at(-1)).toBe(2);
  expect(random.outcomes).toHaveLength(2);
  expect(random.outcomes.every((outcome) => outcome.dps > 0 && Array.isArray(outcome.metrics))).toBe(true);
  expect(await uiImports(await randomWorkerReady)).toEqual([]);

  // Native navigation asks the baseline worker for a missing comparison, then Workspace edits drop it again.
  expect(await page.evaluate(() => window.professionApp.analysis.state.patchComparison)).toBeNull();
  await page.locator('.simulator-view-tab[data-simulator-view="analysis"]').click();
  await page.waitForFunction(
    () =>
      window.professionApp.analysis.state.patchComparison &&
      window.professionApp.analysis.state.simulationStatus === 'idle'
  );
  expect(
    await page.evaluate(() => {
      const app = window.professionApp;
      return (
        app.analysis.state.patchComparison.preview === app.analysis.state.results &&
        Boolean(app.analysis.state.patchComparison.current)
      );
    })
  ).toBe(true);
  await page.locator('.simulator-view-tab[data-simulator-view="workspace"]').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation.push({ type: 'wait', durationMs: 100 });
    app.changed(false);
  });
  await page.waitForFunction(
    () => window.professionApp.analysis.state.buildRevision === window.professionApp.analysis.state.resultRevision
  );
  expect(await page.evaluate(() => window.professionApp.analysis.state.patchComparison)).toBeNull();
  expect(
    await page.evaluate(() => {
      const app = window.professionApp;
      return app.adapter.baselineSimulationRequest(app).comparisonConfig;
    })
  ).toBeUndefined();
  await page.locator('.simulator-view-tab[data-simulator-view="analysis"]').click();
  await page.waitForFunction(
    () =>
      window.professionApp.analysis.state.patchComparison &&
      window.professionApp.analysis.state.simulationStatus === 'idle'
  );
});
