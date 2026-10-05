import assert from 'node:assert/strict';
import test from 'node:test';
import { EffectRecorder, effectStateAt, effectSummary } from '#gw2/platform/results/effect-report.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { gunsAndGloryExplosion } from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

import { planningBuffAt, planningBuffStacks } from '#gw2/platform/results/query.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';

const track = (result, kind) =>
  result.effectReport.tracks.find(
    (value) => value.kind === kind && value.recipient === 'self' && value.origin === 'simulated'
  );
const buff = (kind, at, stacks, duration) => ({
  type: 'buff',
  kind,
  at,
  stacks,
  duration,
  source: 'Test',
  sourceId: 'test.effect',
  actorType: 'player'
});

test('combat and reporting cap Aegis and non-damaging presence while retaining Vulnerability intensity', () => {
  const native = warriorProfession.runtimeFor({});
  const counts = [];
  const result = runGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        for (const at of [0, 1]) {
          runtime.effects.emit({ kind: 'packet', event: buff('aegis', at, 5, 2) });
          for (const condition of ['Weakness', 'Crippled', 'Vulnerability', 'Burning'])
            runtime.effects.emit({ kind: 'packet', event: { ...buff('', at, 20, 2), type: 'condition', condition } });
        }

        runtime.schedule('test.conditions', 1.5, null);
      },
      tasks: {
        ...native.tasks,
        'test.conditions'(runtime) {
          for (const condition of ['Weakness', 'Crippled', 'Vulnerability', 'Burning'])
            counts.push(runtime.combat.targetConditionStacks(condition, runtime.time));
          counts.push(runtime.combat.activeBoonStacks('aegis', runtime.time, Infinity));
        }
      }
    },
    config: {},
    rotation: [{ type: 'wait', durationMs: 4000 }]
  });
  assert.deepEqual(counts, [1, 1, 25, 40, 1]);
  for (const [kind, maximum] of [
    ['aegis', 1],
    ['Weakness', 1],
    ['Crippled', 1],
    ['Vulnerability', 25]
  ]) {
    const effect = result.effectReport.tracks.find((value) => value.kind === kind && value.origin === 'simulated');
    assert.equal(effect.countLimit, maximum);
    assert.ok(effect.segments.every((segment) => segment.count <= maximum));
  }
});

/** Exercise actual trait owners and accepted execution, including off-tick grants and selected balance data. */
function bladesworn(family = warriorProfession, patchId = 'current', output = 'detailed') {
  const config = {
    specialization: 'Bladesworn',
    patchId,
    selectedTraitIds: [TRAIT.GUNS_AND_GLORY, TRAIT.FIERCE_AS_FIRE]
  };
  const native = family.runtimeFor(config);
  return runGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        runtime.effects.emit({ kind: 'packet', event: buff('fierce-as-fire', 0, 20, 4) });
        runtime.effects.emit({ kind: 'packet', event: buff('fierce-as-fire', 2, 3, 5) });
        for (let index = 0; index < 20; index++) runtime.schedule('test.glory', 0.001 + index / 1000, null);
      },
      tasks: {
        ...native.tasks,
        'test.glory'(runtime) {
          gunsAndGloryExplosion(runtime, buff('test-explosion', runtime.time, 1, 0));
        }
      }
    },
    config,
    output,
    rotation: [{ type: 'wait', durationMs: 15000 }]
  });
}

test('engine snapshots bound Fierce as Fire and off-tick Guns and Glory before chart consumption', () => {
  const result = bladesworn();
  const fire = track(result, 'fierce-as-fire');
  const glory = track(result, 'guns-and-glory');
  assert.equal(fire.countLimit, 10);
  assert.equal(glory.durationLimit, 12);
  assert.equal(effectStateAt(result.effectReport, fire, 3).count, 10);
  assert.equal(effectStateAt(result.effectReport, fire, 4).count, 3);
  for (const segment of glory.segments) assert.ok(segment.expiresAt - segment.start <= 12 + 1e-9);
  for (const interval of [50, 1000]) {
    const series = buildChartSeries(
      result,
      interval,
      warriorProfession.ui.effectPresentations({ specialization: 'Bladesworn', catalog: warriorProfession.catalog })
    );
    assert.ok(series.effects['Fierce as Fire'].every((point) => point.v <= 10));
    assert.ok(series.effects['Guns and Glory'].every((point) => point.v <= 12 + 1e-9));
    assert.equal(series.effectSummaries['Fierce as Fire'].averageStacks, 49 / 15);
  }
});

test('a selected balance patch changes recorded caps without presentation policy', () => {
  const family = withPatchPreview(warriorProfession, {
    id: 'effect-contract',
    label: 'Effect contract',
    professions: {
      warrior: {
        balanceProfiles: {
          [TRAIT.FIERCE_AS_FIRE]: { fields: { maximumStacks: 4 } },
          [TRAIT.GUNS_AND_GLORY]: { fields: { maximumStacks: 7 } }
        }
      }
    }
  });
  const result = bladesworn(family, 'effect-contract');
  assert.equal(track(result, 'fierce-as-fire').countLimit, 4);
  assert.equal(track(result, 'guns-and-glory').durationLimit, 7);
  assert.ok(track(result, 'guns-and-glory').segments.every((segment) => segment.expiresAt - segment.start <= 7 + 1e-9));
});

test('recording leaves score execution unchanged', () => {
  const detailed = bladesworn();
  const score = bladesworn(warriorProfession, 'current', 'score');
  for (const key of Object.keys(score).filter((key) => key !== 'output'))
    assert.deepEqual(detailed[key], score[key], key);
});

test('consumption, refresh, replacement, and natural expiry integrate exact half-open windows', () => {
  const recorder = new EffectRecorder();
  const frame = (at, windows) => recorder.capture(at, [timedEffectState('charges', windows, 3)]);
  frame(0, [{ stacks: 3, expiresAt: 5 }]);
  frame(0.125, [{ stacks: 2, expiresAt: 5 }]);
  frame(1, [{ stacks: 2, expiresAt: 8 }]);
  frame(2, [{ stacks: 1, expiresAt: 3 }]);
  const report = recorder.finish(10);
  const state = report.tracks[0];
  assert.equal(effectStateAt(report, state, 0.125).count, 2);
  assert.equal(effectStateAt(report, state, 2).count, 1);
  assert.equal(effectStateAt(report, state, 3).count, 0);
  assert.equal(effectStateAt(report, state, 8).count, 0);
  assert.equal(effectSummary(state, 0, 10).averageStacks, 0.5125);
  assert.equal(effectSummary(state, 0, 10).uptime, 0.3);
});

test('zero charges never become presence and observations detach mutable owner state', () => {
  const recorder = new EffectRecorder();
  const windows = [{ stacks: 2, expiresAt: 5 }];
  recorder.capture(0, [timedEffectState('charges', windows, 3)]);
  windows[0].stacks = 0;
  recorder.capture(1, [timedEffectState('charges', windows, 3)]);
  const report = recorder.finish(5);
  assert.equal(effectStateAt(report, report.tracks[0], 0.5).count, 2);
  assert.equal(effectStateAt(report, report.tracks[0], 1).count, 0);
});

test('combat history ends at death while the planning observation includes later self effects', () => {
  const native = warriorProfession.runtimeFor({});
  const result = runGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        runtime.effects.emit({
          kind: 'packet',
          event: { type: 'damage', at: 1, flatDamage: 10, source: 'Test', sourceId: 'test.hit', actorType: 'player' }
        });
        runtime.effects.emit({ kind: 'packet', event: buff('peak-performance', 2, 1, 10) });
      }
    },
    config: { target: { health: 1 } },
    rotation: [{ type: 'wait', durationMs: 4000 }]
  });
  assert.equal(result.effectReport.end, 1);
  // The editor reads its detached boundary; post-death effects never enter chart history.
  assert.equal(result.planningState.atSeconds, 4);
  assert.equal(planningBuffStacks(result.planningState, 'peak-performance'), 1);
  assert.equal(planningBuffAt(result.planningState, 'peak-performance').remaining, 8);
  assert.equal(track(result, 'peak-performance'), undefined);
  assert.ok(result.planningState.effects.some((effect) => effect.kind === 'peak-performance' && effect.windows.length));
});

// Registration rejects missing or competing owners before an uncapped track can escape into results.
test('effect observation rejects unregistered buffs and duplicate native policies', () => {
  const runtime = {
    boons: new Map([]),
    retiredCompanions: new Map(),
    buffs: new Map([['unknown', []]]),
    config: {},
    conditionState: new Map(),
    time: 0,
    equipmentBuffPolicies: []
  };
  assert.throws(() => observeRuntimeEffects(runtime, {}), /Missing buff policy: unknown/);
  assert.throws(
    () => observeRuntimeEffects(runtime, { buffPolicies: () => [{ kind: 'unknown' }, { kind: 'unknown' }] }),
    /Duplicate profession buff policy/
  );
});

// Shattering Stone replaces its three-charge grant and consumes on hits; overlapping grant receipts are not active stacks.
test('Shattering Stone reports remaining owner charges after hits and replacement', () => {
  const native = elementalistProfession.runtimeFor({});
  const result = runGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        for (const at of [0, 2]) runtime.effects.emit({ kind: 'packet', event: buff('shattering stone', at, 3, 10) });
        for (const at of [1, 3, 4, 5])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at,
              coefficient: 0.1,
              weaponStrength: 1000,
              source: 'Test',
              sourceId: 'test.hit',
              actorType: 'player'
            }
          });
      }
    },
    config: {},
    rotation: [{ type: 'wait', durationMs: 13000 }]
  });
  const effect = track(result, 'shattering stone');
  assert.equal(effect.countLimit, 3);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 12].map((at) => effectStateAt(result.effectReport, effect, at).count),
    [3, 2, 3, 2, 1, 0, 0]
  );
  const series = buildChartSeries(result);
  assert.ok(series.effects['Shattering stone'].every((point) => point.v <= 3));
  // DPS begins with the strike at 1s: two + three + two + one charge-seconds over twelve seconds.
  assert.equal(series.effectSummaries['Shattering stone'].averageStacks, 8 / 12);
});
