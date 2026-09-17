import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline-simulation-runner.js';
import { guardianAppAdapter } from '#gw2/professions/guardian/app/app-definition.js';
import { guardianPreviewSelection } from '#gw2/app/simulation/preview-controls.js';
import { captureGearOptimizerRequest } from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';

test('browser preview requests preserve authored inputs and reject unsupported analyses before legacy capture', () => {
  const build = guardianAppAdapter.toApplicationBuild(
    JSON.parse(
      readFileSync(new URL('../../data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json', import.meta.url))
    )
  );
  build.rotation = [{ type: 'cast', skillId: 72031 }];
  const app = {
    gameId: 'gw2',
    contentId: 'guardian',
    profession: guardianAppAdapter.profession,
    previewSelection: guardianPreviewSelection(),
    build
  };
  const before = structuredClone(build);
  const request = guardianAppAdapter.baselineSimulationRequest(app);
  assert.equal(request.selection.engine, 'preview');
  assert.deepEqual(request.rotation, build.rotation);
  assert.notEqual(request.rotation, build.rotation);
  assert.equal(request.selection.build.gear.Helm, build.gear.Helm);
  for (const capture of [
    () => guardianAppAdapter.simulationConfig(app),
    () => guardianAppAdapter.randomDistributionRequest(app),
    () => guardianAppAdapter.modifierContributionRequest(app),
    () => guardianAppAdapter.relicComparisonRequest(app),
    () => captureGearOptimizerRequest(app, {})
  ])
    assert.throws(capture, /unavailable|preview/i);
  assert.deepEqual(build, before);
  app.simulationSettings = { transitionDelays: { weaponSwapMs: 100 } };
  assert.throws(
    () => guardianAppAdapter.baselineSimulationRequest(app),
    (error) => error.path === 'simulationSettings.transitionDelays'
  );
});

// Simulate queued messages from workers whose synchronous loop was abandoned by a newer preview edit.
test('baseline preview workers coalesce replacements, validate identity, ignore abandoned replies and recover', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => (original ? Object.defineProperty(globalThis, 'Worker', original) : delete globalThis.Worker));
  const workers = [];
  class Worker {
    listeners = new Map();
    terminated = false;
    constructor() {
      workers.push(this);
    }
    addEventListener(type, callback) {
      this.listeners.set(type, callback);
    }
    postMessage(job) {
      this.job = job;
    }
    terminate() {
      this.terminated = true;
    }
    respond(output, extra = {}) {
      this.listeners.get('message')({ data: { ...this.job, output, ...extra } });
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: Worker });
  const published = [],
    errors = [];
  const app = {
    buildRevision: 1,
    workspace: { activeTabId: 'first' },
    previewSelection: guardianPreviewSelection(),
    adapter: {
      baselineSimulationRequest: () => ({
        selection: app.previewSelection ?? { engine: 'legacy' },
        rotation: [{ type: 'wait', durationMs: 1 }]
      }),
      calculateBaselineSimulation: () => assert.fail('preview fallback must not run')
    },
    publishBaselineSimulation: (output) => published.push(output),
    failBaselineSimulation: (error) => errors.push(String(error))
  };
  const success = (contentRevision = app.previewSelection.contentRevision) => ({
    ok: true,
    output: 'detailed',
    identity: { engine: 'gw2.combat-engine', mode: 'detailed', contentRevision, seed: 1 },
    result: { engine: 'preview', totalDamage: 10 }
  });
  const runner = new BaselineSimulationRunner(app);
  runner.schedule(1);
  t.mock.timers.tick(40);
  app.buildRevision = 2;
  runner.schedule(2);
  app.buildRevision = 3;
  runner.schedule(3);
  t.mock.timers.tick(40);
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  workers[0].respond(success());
  workers[0].listeners.get('error')({ message: 'late error' });
  workers[1].respond(success(), { revision: 0 });
  assert.deepEqual(published, []);
  assert.deepEqual(errors, []);
  workers[1].respond(success('wrong-content'));
  assert.match(errors.at(-1), /identity/);
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  workers.at(-1).respond(success());
  assert.equal(published.length, 1);
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  app.workspace.activeTabId = 'second';
  workers.at(-1).respond(success());
  assert.equal(published.length, 1);
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  const abandoned = workers.at(-1);
  const lateSuccess = success();
  delete app.previewSelection;
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  assert.equal(abandoned.terminated, true);
  abandoned.respond(lateSuccess);
  abandoned.listeners.get('error')({ message: 'late engine error' });
  workers.at(-1).respond({ result: { engine: 'legacy' }, patchComparison: null });
  assert.equal(published.at(-1).result.engine, 'legacy');

  app.previewSelection = guardianPreviewSelection();
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: undefined });
  runner.cancel();
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  assert.match(errors.at(-1), /requires Web Workers/);
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: class {
      constructor() {
        throw new Error('Worker blocked');
      }
    }
  });
  runner.cancel(true);
  app.buildRevision++;
  runner.schedule(app.buildRevision);
  t.mock.timers.tick(40);
  assert.match(errors.at(-1), /Worker blocked/);
});
