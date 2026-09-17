import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateBaselineSimulation } from '#gw2/app/simulation/baseline-simulation.js';
import { calculateCommonAttributes } from '#gw2/platform/builds/attributes.js';
import { prepareEncounter } from '#gw2/platform/combat-engine/run.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { buildChartSeries, skillBreakdownRows } from '#gw2/app/results/model.js';
import { simulationEventLogRows } from '#gw2/app/results/simulation-event-log.js';
import { migrateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import {
  compileGuardianPreview,
  GUARDIAN_PREVIEW_CONTENT_REVISION
} from '#gw2/professions/guardian/combat-engine/compile.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';

const savedBuild = JSON.parse(
  readFileSync(new URL('../../data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json', import.meta.url))
);
const savedRotation = JSON.parse(
  readFileSync(new URL('../../data/gw2/rotations/guardian/r-condi-willbender-pistol-torch-bench.json', import.meta.url))
).rotation;
const request = (rotation = []) => ({
  profession: guardianProfession,
  selection: {
    engine: 'preview',
    contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION,
    patchId: 'reference',
    build: migrateGuardianBuild(savedBuild)
  },
  rotation
});

test('the existing saved Willbender inputs load and run through the shared preview boundary', () => {
  const input = request(savedRotation);
  const before = structuredClone({ selection: input.selection, rotation: input.rotation });
  const result = simulateGw2(input);
  assert.equal(result.ok, true, result.message);
  assert.ok(Number.isFinite(result.result.dps));
  assert.equal(result.identity.contentRevision, GUARDIAN_PREVIEW_CONTENT_REVISION);
  assert.doesNotThrow(() => buildChartSeries(result.result));
  assert.doesNotThrow(() => skillBreakdownRows(result.result));
  assert.doesNotThrow(() => simulationEventLogRows(result.result));
  assert.deepEqual({ selection: input.selection, rotation: input.rotation }, before);
});

test('edited gear is compiled from common attributes and copied worker inputs select the same engine', () => {
  const input = request([{ type: 'cast', skillId: 72031 }]);
  input.selection.build.gear.Helm = "Berserker's";
  input.selection.build.jadeBotCore = false;
  const common = calculateCommonAttributes(input.selection.build).attributes;
  const prepared = prepareEncounter(compileGuardianPreview(input).encounter);
  const player = prepared.actors[0].build;
  assert.equal(player.attributes.get('power'), common.Power.final);
  assert.equal(player.attributes.get('condition_damage'), common['Condition Damage'].final);
  assert.equal(player.attributes.get('vitality'), common.Vitality.final);
  assert.ok(
    !player.permanentUniqueEffects.some(
      (effect) =>
        effect.uniqueEffectKey === 'Toxic Focusing Crystal' || effect.uniqueEffectKey === 'Jade Bot Core: Tier 10'
    )
  );
  const { profession, ...serializable } = input;
  const detailed = calculateBaselineSimulation(
    structuredClone({ ...serializable, gameId: 'gw2', contentId: 'guardian' }),
    profession
  );
  const score = simulateGw2({ ...input, output: 'score' });
  assert.equal(detailed.ok, true, detailed.message);
  assert.equal(score.result.totalDamage, detailed.result.totalDamage);
  assert.equal(score.reference.endTick, detailed.reference.endTick);
  assert.equal(score.reference.events, undefined);
  assert.equal(score.result.events, undefined);
});

test('unsupported preview selections and commands fail at their responsible fields', () => {
  const cases = [
    [(r) => (r.selection.build.rune = 'Trapper'), 'build.rune'],
    [(r) => (r.selection.build.assumptions.targetMoving = true), 'build.assumptions.targetMoving'],
    [(r) => (r.selection.contentRevision = 'other'), 'selection.contentRevision'],
    [(r) => (r.selection.patchId = 'current'), 'selection.patchId'],
    [(r) => r.rotation.push({ type: 'cast', skillId: 1234567 }), 'rotation[0].skillId'],
    [(r) => r.rotation.push({ type: 'cast', skillId: 72031, releaseAtCharges: 2 }), 'rotation[0].releaseAtCharges'],
    [
      (r) => r.rotation.push({ type: 'cast', skillId: 72031, initialStateDurationMs: 5 }),
      'rotation[0].initialStateDurationMs'
    ],
    [(r) => r.rotation.push({ type: 'cooldown-reset' }), 'rotation[0].type'],
    [(r) => r.rotation.push({ type: 'wait', durationMs: 0.5 }), 'rotation[0].durationMs'],
    [(r) => (r.operation = 'modifier-contribution'), 'operation'],
    [(r) => (r.operation = 'prefix'), 'insertionIndex'],
    [(r) => (r.observationPolicy = null), 'observationPolicy'],
    [(r) => (r.observationPolicy = { kind: 'tail', durationMs: -1 }), 'observationPolicy'],
    [(r) => (r.observationPolicy = { kind: 'unknown' }), 'observationPolicy.kind']
  ];
  for (const [change, path] of cases) {
    const input = request();
    change(input);
    assert.throws(
      () => simulateGw2(input),
      (error) => error.path === path,
      path
    );
  }
});

test('unselected requests remain legacy and copied preview configurations cannot silently run an analysis there', () => {
  const legacy = simulateGw2({ profession: guardianProfession, rotation: [] });
  assert.ok(legacy.schedulerState);
  const input = request();
  for (const output of ['score', 'detailed']) {
    assert.throws(
      () =>
        simulateGw2({
          profession: guardianProfession,
          rotation: [],
          output,
          config: { engineSelection: input.selection }
        }),
      (error) => error.path === 'config.engineSelection'
    );
  }

  const empty = simulateGw2(input);
  assert.equal(empty.ok, true, empty.message);
  assert.equal(empty.result.dps, 0);
  const unavailable = simulateGw2(request([{ type: 'cast', skillId: 9089 }]));
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.path, 'rotation[0]');
});

test('an engine work-limit failure stays a failure without publishing partial view totals', () => {
  const input = request([{ type: 'cast', skillId: 72031 }]);
  input.profession = {
    ...guardianProfession,
    simulation: {
      ...guardianProfession.simulation,
      compileCombatPreview: (value) => ({ ...compileGuardianPreview(value), tickLimit: 0 })
    }
  };
  const failed = simulateGw2(input);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'loop.tick-limit');
  assert.equal(failed.result, undefined);
});

test('shared prefix requests validate the cursor and ignore report tails at append', () => {
  const input = request([
    { type: 'cast', skillId: 72031 },
    { type: 'wait', durationMs: 20 }
  ]);
  for (const insertionIndex of [-1, 0.5, 3]) {
    assert.throws(
      () => simulateGw2({ ...input, operation: 'prefix', insertionIndex }),
      (error) => error.path === 'insertionIndex'
    );
  }

  const beginning = simulateGw2({ ...input, operation: 'prefix', insertionIndex: 0 });
  assert.equal(beginning.ok, true, beginning.message);
  assert.equal(beginning.state.time, 0);
  const middle = simulateGw2({ ...input, operation: 'prefix', insertionIndex: 1 });
  const end = simulateGw2({ ...input, operation: 'prefix', insertionIndex: 2 });
  const tail = simulateGw2({
    ...input,
    operation: 'prefix',
    insertionIndex: 2,
    observationPolicy: { kind: 'tail', durationMs: 1000 }
  });
  assert.equal(middle.ok, true, middle.message);
  assert.equal(end.ok, true, end.message);
  assert.ok(end.state.time > middle.state.time);
  assert.deepEqual(tail, end);
  const failed = simulateGw2({ ...request([{ type: 'cast', skillId: 9089 }]), operation: 'prefix', insertionIndex: 1 });
  assert.equal(failed.ok, false);
  assert.equal(failed.path, 'rotation[0]');
});
