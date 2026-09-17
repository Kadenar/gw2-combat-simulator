import { expect, test } from '@playwright/test';

// The adapter accepts cloned UI input inside the baseline worker and keeps validation failures off the legacy path.
test('preview baseline workers translate existing builds and recover after an unsupported request', async ({
  page
}) => {
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const ready = page.waitForEvent('worker', (worker) => worker.url().includes('baseline-simulation-worker'));
  const response = await page.evaluate(async () => {
    const { migrateGuardianBuild } = await import('/js/games/gw2/professions/guardian/build/build.ts');
    const { GUARDIAN_PREVIEW_CONTENT_REVISION } =
      await import('/js/games/gw2/professions/guardian/combat-engine/compile.ts');
    const saved = await fetch('/data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json').then((result) =>
      result.json()
    );
    const request = {
      gameId: 'gw2',
      contentId: 'guardian',
      output: 'score',
      selection: {
        engine: 'preview',
        patchId: 'reference',
        contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION,
        build: migrateGuardianBuild(saved)
      },
      rotation: [{ type: 'cast', skillId: 72031 }]
    };
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/baseline-simulation-worker.ts', { type: 'module' });
      let failure;
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.requestId === 1) {
          failure = data;
          worker.postMessage({ requestId: 2, revision: 12, request });
        } else resolve({ failure, success: data });
      });
      worker.postMessage({ requestId: 1, revision: 11, request: { ...request, operation: 'modifier-contribution' } });
    });
  });
  expect(response.failure.error).toContain('operation');
  expect(response.failure.output).toBeUndefined();
  expect(response.success.revision).toBe(12);
  expect(response.success.output.ok).toBe(true);
  expect(response.success.output.identity.engine).toBe('gw2.combat-engine');
  expect(response.success.output.output).toBe('score');
  expect(response.success.output.result.output).toBe('score');
  expect(response.success.output.reference.events).toBeUndefined();
  const imports = await (
    await ready
  ).evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(
    imports.filter((url) => /\/app\/(?:create-adapter\.|build-editor\.|build\/|rotation\/|results\/)/.test(url))
  ).toEqual([]);
});

// Both prepared jobs must finish in real module workers without importing browser adapters, editors, or result views.
test('modifier and RNG workers simulate without loading UI dependencies', async ({ page }) => {
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.professionApp.addRotation('Bladecall'));
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const uiImports = (worker) =>
    worker.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /\/app\/(?:create-adapter\.|build-editor\.|build\/|rotation\/|results\/)/.test(url))
    );

  const modifierWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('modifier-contribution-worker')
  );
  const contributions = await page.evaluate(() => {
    const app = window.professionApp;
    app.modifierContributionRunner.cancel();
    const request = app.adapter.modifierContributionRequest(app);
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/modifiers/modifier-contribution-worker.ts', {
        type: 'module'
      });
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      });
      worker.postMessage({ requestId: 17, request });
    });
  });
  expect(contributions.requestId).toBe(17);
  expect(contributions.contributions.length).toBeGreaterThan(0);
  expect(contributions.contributions[0].dpsIncrease).toBeGreaterThan(0);
  expect(await uiImports(await modifierWorkerReady)).toEqual([]);

  const randomWorkerReady = page.waitForEvent('worker', (worker) =>
    worker.url().includes('random-distribution-worker')
  );
  const random = await page.evaluate(() => {
    const app = window.professionApp;
    const request = { ...app.adapter.randomDistributionRequest(app), trials: 2 };
    return new Promise((resolve, reject) => {
      const worker = new Worker('/js/games/gw2/app/simulation/random-distribution/random-distribution-worker.ts', {
        type: 'module'
      });
      const progress = [];
      worker.addEventListener('error', (event) => reject(new Error(event.message)));
      worker.addEventListener('message', ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else if (data.progress) progress.push(data.progress.completed);
        else resolve({ requestId: data.requestId, distribution: data.distribution, progress });
      });
      worker.postMessage({ requestId: 1, request, includeSamples: true });
    });
  });
  expect(random.requestId).toBe(1);
  expect(random.progress[0]).toBe(0);
  expect(random.progress.at(-1)).toBe(2);
  expect(random.distribution.trials).toBe(2);
  expect(random.distribution.mean).toBeGreaterThan(0);
  expect(random.distribution.samples).toHaveLength(2);
  expect(await uiImports(await randomWorkerReady)).toEqual([]);
});
