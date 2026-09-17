import { expect, test } from '@playwright/test';

// Render the headless preview through the existing views without enabling the editor's engine selector.
test('preview results render timeline, summary, damage charts and event log without scheduler internals', async ({
  page
}) => {
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const facts = await page.evaluate(async () => {
    const { simulateGw2 } = await import('/js/games/gw2/platform/simulation/simulate.ts');
    const { guardianProfession } = await import('/js/games/gw2/professions/guardian/definition.ts');
    const { migrateGuardianBuild } = await import('/js/games/gw2/professions/guardian/build/build.ts');
    const { GUARDIAN_PREVIEW_CONTENT_REVISION } =
      await import('/js/games/gw2/professions/guardian/combat-engine/compile.ts');
    const { createGw2SimulationViewModel } = await import('/js/games/gw2/app/results/view.ts');
    const { timelineRowsView } = await import('/js/games/gw2/app/rotation/timeline/rows.ts');
    const { renderEventLog } = await import('/js/games/gw2/app/results/simulation-event-log.ts');
    const saved = await fetch('/data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json').then((response) =>
      response.json()
    );
    const build = migrateGuardianBuild(saved);
    build.assumptions.targetConditions.Burning = 1;
    const rotation = [{ type: 'combat-start' }, { type: 'cast', skillId: 72031 }, { type: 'wait', durationMs: 1200 }];
    const outcome = simulateGw2({
      profession: guardianProfession,
      selection: { engine: 'preview', contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION, patchId: 'reference', build },
      rotation,
      observationPolicy: { kind: 'tail', durationMs: 1000 }
    });
    if (!outcome.ok) throw new Error(outcome.message);
    const app = window.professionApp;
    const viewApp = Object.assign(Object.create(app), {
      build: { ...app.build, ...build, rotation },
      results: outcome.result
    });
    document.body.dataset.simulatorView = 'analysis';
    const root = document.createElement('section');
    root.id = 'preview-test-results';
    document.body.append(root);
    const summary = document.createElement('div');
    const analysis = document.createElement('div');
    const timeline = document.createElement('div');
    timeline.id = 'preview-test-timeline';
    root.append(summary, analysis, timeline);
    root.append(document.getElementById('rotation-event-log'));
    const view = createGw2SimulationViewModel(viewApp);
    view.summary.panels[0].mount(summary);
    view.analysis.panels[0].mount(analysis);
    timeline.innerHTML = timelineRowsView(viewApp, viewApp.build, outcome.result, true, new Set(), false)
      .rows.map((row) => row.html)
      .join('');
    renderEventLog(viewApp);
    return {
      warnings: outcome.result.warnings,
      hasScheduler: 'schedulerState' in outcome.result,
      hasEndState: 'endState' in outcome.result,
      damage: outcome.result.totalDamage,
      environment: outcome.result.environmentDamage
    };
  });
  expect(facts.warnings).toEqual([]);
  expect(facts.hasScheduler).toBe(false);
  expect(facts.hasEndState).toBe(false);
  expect(facts.damage).toBeGreaterThan(0);
  expect(facts.environment).toBeGreaterThan(0);
  await expect(page.locator('#preview-test-results')).toContainText('Player Damage');
  await expect(page.locator('#preview-test-results')).toContainText('Environment Damage');
  await expect(page.locator('#preview-test-results [data-role="skill-rows"]')).not.toBeEmpty();
  await expect(page.locator('#preview-test-timeline .rot-skill[title*="Through the Heart"]')).toBeVisible();
  await page.locator('#rotation-event-log summary').click();
  await expect(page.locator('#rotation-event-log')).toContainText('CAST Through the Heart');
  await expect(page.locator('#rotation-event-log')).toContainText('TICK Bleeding');
});

// Keep this opt-in test harness separate from the production selector planned for Phase 3.5.
test('preview cursor state runs in a worker and keeps long-rotation editing responsive', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const { renderPalette } = await import('/js/games/gw2/app/rotation/palette/view.ts');
    const { renderRotationStateSnapshot } = await import('/js/games/gw2/app/rotation/state-snapshot/view.ts');
    const { PrefixSimulationRunner } = await import('/js/games/gw2/app/simulation/prefix-simulation-runner.ts');
    const { GUARDIAN_PREVIEW_CONTENT_REVISION } =
      await import('/js/games/gw2/professions/guardian/combat-engine/compile.ts');
    const [saved, savedRotation] = await Promise.all([
      fetch('/data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json').then((response) => response.json()),
      fetch('/data/gw2/rotations/guardian/r-condi-willbender-pistol-torch-bench.json').then((response) =>
        response.json()
      )
    ]);
    const app = window.professionApp;
    const build = app.adapter.toApplicationBuild(saved);
    build.rotation = savedRotation.rotation;
    // Let the complete saved sequence reach append; a killed target correctly makes later prefixes unavailable.
    build.targetHealth = 1_000_000_000;
    const viewApp = (window.prefixTestApp = Object.assign(Object.create(app), {
      build,
      buildRevision: app.buildRevision + 1,
      rotationInsertionIndex: 0,
      previewSelection: { engine: 'preview', contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION, patchId: 'reference' },
      profession: {
        ...app.profession,
        ui: {
          ...app.profession.ui,
          paletteSkillAvailability: () => {
            throw new Error('Legacy availability called');
          }
        }
      },
      rotationEndStateAt: () => {
        throw new Error('Main-thread replay called');
      }
    }));
    window.prefixRender = () => renderPalette(viewApp);
    viewApp.prefixSimulationRunner = new PrefixSimulationRunner(viewApp, () => {
      window.prefixRender();
      renderRotationStateSnapshot(viewApp);
    });
    window.prefixRender();
  });
  await page.waitForFunction(() => window.prefixTestApp.prefixSimulationRunner.status === 'ready');
  expect(await page.evaluate(() => window.prefixTestApp.prefixSimulationRunner.current().time)).toBe(0);
  const facts = await page.evaluate(async () => {
    const app = window.prefixTestApp;
    app.rotationInsertionIndex = app.build.rotation.length;
    window.prefixRender();
    const pending = app.prefixSimulationRunner.current() === null;
    let beats = 0;
    const interval = setInterval(() => beats++, 10);
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 250));
    clearInterval(interval);
    const elapsed = performance.now() - start;
    const stillPending = app.prefixSimulationRunner.status === 'pending';
    // A cursor edit abandons the long run; the replacement must be runnable immediately.
    app.rotationInsertionIndex = 1;
    window.prefixRender();
    return { pending, stillPending, beats, elapsed };
  });
  expect(facts.pending).toBe(true);
  expect(facts.stillPending).toBe(true);
  expect(facts.beats).toBeGreaterThan(3);
  expect(facts.elapsed).toBeLessThan(1500);
  await page.waitForFunction(() => window.prefixTestApp.prefixSimulationRunner.status === 'ready');
  expect(await page.evaluate(() => window.prefixTestApp.prefixSimulationRunner.current().insertionIndex)).toBe(1);
  await page.evaluate(() => {
    const app = window.prefixTestApp;
    app.rotationInsertionIndex = app.build.rotation.length;
    window.prefixRender();
  });
  await page.waitForFunction(() => window.prefixTestApp.prefixSimulationRunner.status !== 'pending', null, {
    timeout: 40_000
  });
  expect(await page.evaluate(() => window.prefixTestApp.prefixSimulationRunner.error)).toBe('');
  const end = await page.evaluate(() => {
    const app = window.prefixTestApp;
    const state = app.prefixSimulationRunner.current();
    return {
      atAppend: state.insertionIndex === app.build.rotation.length,
      time: state.time,
      availability: Object.keys(state.availability).length
    };
  });
  expect(end.atAppend).toBe(true);
  expect(end.time).toBeGreaterThan(0);
  expect(end.availability).toBeGreaterThan(0);
  await expect(page.locator('#rotation-palette [role="status"]')).toHaveCount(0);
  await expect(page.locator('#rotation-active-buffs')).toContainText('Weapon set');
});
