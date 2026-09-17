import assert from 'node:assert/strict';
import test from 'node:test';
import { PrefixSimulationRunner } from '#gw2/app/simulation/prefix-simulation-runner.js';
import { paletteEndState } from '#gw2/app/rotation/shared/context.js';
import { paletteSkillView, displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';

// Controlled workers expose late messages even after termination, as queued browser messages can still arrive.
test('prefix queries coalesce edits, invalidate identities, reject stale work, and recover after failure', (t) => {
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
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.request = structuredClone(message);
    }
    terminate() {
      this.terminated = true;
    }
    respond(overrides = {}) {
      const { requestId, revision, request } = this.request;
      this.listeners.get('message')({
        data: {
          requestId,
          revision,
          output: {
            ok: true,
            output: 'prefix',
            identity: {
              engine: 'gw2.combat-engine',
              mode: 'detailed',
              stepMs: 1,
              contentRevision: request.selection.contentRevision,
              seed: request.seed
            },
            state: { insertionIndex: request.insertionIndex, time: 5, availability: {}, counters: {} }
          },
          ...overrides
        }
      });
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: Worker });
  const app = {
    gameId: 'gw2',
    contentId: 'guardian',
    patchId: 'reference',
    buildRevision: 1,
    workspace: { activeTabId: 'first' },
    build: { rotation: [{ type: 'wait', durationMs: 5 }], assumptions: { simulationMode: 'average' } },
    previewSelection: { engine: 'preview', contentRevision: 'content', patchId: 'reference' },
    profession: { migrateBuild: (build) => structuredClone(build) },
    rotationEndStateAt: () => assert.fail('preview rendering cannot replay legacy combat')
  };
  let updates = 0;
  const runner = (app.prefixSimulationRunner = new PrefixSimulationRunner(app, () => updates++));
  runner.refresh();
  app.rotationInsertionIndex = 0;
  runner.refresh();
  assert.equal(paletteEndState(app), null);
  t.mock.timers.tick(40);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].request.request.insertionIndex, 0);
  workers[0].respond();
  assert.equal(runner.status, 'ready');
  assert.equal(paletteEndState(app).insertionIndex, 0);
  assert.equal(workers[0].terminated, true);

  for (const change of [
    () => (app.rotationInsertionIndex = 1),
    () => app.buildRevision++,
    () => (app.workspace.activeTabId = 'second'),
    () => (app.previewSelection.seed = 7),
    () => (app.previewSelection.contentRevision = 'updated'),
    () => (app.patchId = 'changed'),
    () => (app.build.assumptions.simulationMode = 'random')
  ]) {
    const oldWorker = workers.at(-1);
    change();
    assert.equal(runner.current(), null);
    runner.refresh();
    assert.equal(runner.status, 'pending');
    oldWorker.respond();
    oldWorker.listeners.get('error')({ message: 'late error' });
    assert.equal(runner.current(), null);
    t.mock.timers.tick(40);
    workers.at(-1).respond();
    assert.equal(runner.status, 'ready');
  }

  app.buildRevision++;
  runner.refresh();
  t.mock.timers.tick(40);
  const abandoned = workers.at(-1);
  app.buildRevision++;
  runner.refresh();
  t.mock.timers.tick(40);
  assert.equal(abandoned.terminated, true);
  abandoned.respond();
  assert.equal(runner.current(), null);
  workers.at(-1).respond({ error: 'unsupported build', output: undefined });
  assert.equal(runner.status, 'error');
  assert.equal(runner.message(), 'unsupported build');
  app.buildRevision++;
  runner.refresh();
  t.mock.timers.tick(40);
  workers.at(-1).respond();
  assert.ok(runner.current());
  delete app.previewSelection;
  assert.equal(runner.current(), null);
  runner.refresh();
  assert.equal(runner.status, 'idle');
  assert.ok(updates > 0);
});

test('preview without workers reports unavailable instead of simulating on the main thread', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => (original ? Object.defineProperty(globalThis, 'Worker', original) : delete globalThis.Worker));
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: undefined });
  const runner = new PrefixSimulationRunner(
    { previewSelection: {}, build: { rotation: [], assumptions: {} } },
    () => {}
  );
  runner.refresh();
  t.mock.timers.tick(40);
  assert.equal(runner.status, 'error');
  assert.match(runner.message(), /requires Web Workers/);
  assert.equal(runner.current(), null);
});

test('preview palette uses engine flip and castability state without legacy legality or stale ammo', () => {
  const base = { id: 1, name: 'Base', flipSkillId: 2, ammo: 2 };
  const flip = { id: 2, name: 'Flip' };
  let state = {
    time: 5,
    cooldowns: {},
    cooldownsBySkillId: { 2: { remaining: 30, readyAt: 35 } },
    counters: {},
    availability: {
      1: { isAvailableToCast: false, unavailableToCastReason: 'cooldown' },
      2: { isAvailableToCast: true, unavailableToCastReason: '' }
    },
    ammoBySkillId: { 1: { charges: 0, maximum: 2, remaining: 30 } }
  };
  const app = {
    previewSelection: {},
    build: {},
    skills: [base, flip],
    prefixSimulationRunner: { current: () => state, message: () => 'Pending' },
    profession: { ui: { paletteSkillAvailability: () => assert.fail('legacy legality') } }
  };
  assert.equal(displayedSkillTiles(app, [base], {}).at(0).id, 2);
  assert.equal(paletteSkillView(app, flip).disabled, false);
  assert.equal(paletteSkillView(app, base).ammo.current, 0);
  state = null;
  const pending = paletteSkillView(app, base);
  assert.equal(pending.contextDisabled, true);
  assert.equal(pending.ammo, null);
  assert.match(pending.title, /Pending/);
});
