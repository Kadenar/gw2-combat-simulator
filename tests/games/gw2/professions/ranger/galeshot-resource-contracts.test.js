import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  galeshotControlAccepted,
  missileResolved,
  scheduleWindForce
} from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { wait } from '#tests/helpers/commands.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const state = (result) => galeshotState.from(observedRuntime(result).profession);

// Gale Force must cover the first projectile after release, survive dismissal, and expire from release rather than recovery.
test('Hawkeye release owns Gale Force independently of bow dismissal and cast recovery', () => {
  const run = (selectedTraitIds, interruptMs) =>
    runRanger(
      [
        ID.SUMMON_CYCLONE_BOW,
        { type: 'cast', skillId: ID.HAWKEYE, ...(interruptMs == null ? {} : { interruptMs }) },
        { type: 'cast', skillId: ID.DISMISS_CYCLONE_BOW, concurrentOffsetMs: 200 },
        wait(12000)
      ],
      // Isolate the release bonus from seeded critical outcomes in the compared runs.
      { specialization: 'Galeshot', selectedTraitIds, criticalDamageMode: 'averaged' },
      {
        catalog: (catalog) =>
          withSkill(catalog, ID.HAWKEYE, {
            castTimeMs: 2000,
            galeForceApplyMs: 400,
            effects: [
              {
                type: 'strike',
                coefficient: 1,
                weaponStrengthProfileId: 'transform.cyclone-bow',
                atMs: 1000,
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          }),
        initialize(runtime) {
          runtime.resourceController.grant('windForce', 5);
        }
      }
    );
  const enhanced = run([TRAIT.GALE_FORCE]);
  const baseline = run([]);
  const cancelled = run([TRAIT.GALE_FORCE], 100);
  for (const result of [enhanced, baseline, cancelled]) assert.deepEqual(result.warnings, []);
  const damage = (result) => result.resolvedEvents.find((e) => e.type === 'damage' && e.skillId === ID.HAWKEYE).damage;
  assertFlooredDamageMultiplier(damage(enhanced), damage(baseline), 1.25);
  assert.equal(state(enhanced).galeForceUntil, 10.4);
  assert.equal(state(enhanced).cycloneBowActive, false);
  assert.equal(state(cancelled).galeForceUntil, 0);
});

// A delayed reward is independent of the bow bar and capped by the selected policy at its original deadline.
test('Wind Force survives dismissal as pending work and grants once at the selected cap', () => {
  const seen = [];
  const result = runRanger(
    [ID.SUMMON_CYCLONE_BOW, ID.BLUSTER, ID.DISMISS_CYCLONE_BOW, wait(2000)],
    {
      specialization: 'Galeshot'
    },
    {
      catalog: (catalog) =>
        withSkill(withProfile(catalog, TRAIT.TEACHINGS_OF_THE_TENGU, { minimumStacks: 2.5 }), ID.BLUSTER, {
          castTimeMs: 200,
          windForceApplyMs: 1000,
          windForceGain: 6,
          effects: []
        }),
      initialize(runtime) {
        runtime.resourceController.grant('windForce', 1);
      },
      probes: [0.999, 1, 1.2].map((at) => [
        at,
        (runtime) =>
          seen.push([
            runtime.time,
            runtime.resourceController.value('windForce'),
            galeshotState.from(runtime.profession).cycloneBowActive
          ])
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(seen, [
    [0.999, 0, false],
    [1, 2.5, false],
    [1.2, 2.5, false]
  ]);
  assert.equal(state(result).windForce.maximum, 2.5);
  assert.equal(state(result).windForce.unitsPerSecond, 0);
  assert.deepEqual(result.planningState.profession[STATE.WIND_FORCE], state(result).windForce);
  assert.notEqual(result.planningState.profession[STATE.WIND_FORCE], state(result).windForce);
});

// Cast cancellation retains its original grant gate and does not spend Hawkeye's unreleased Wind Force.
test('Wind Force respects interrupted casts and survives cancelled Hawkeye attempts', () => {
  for (const [interruptMs, expected] of [
    [100, 0],
    [400, 0],
    [undefined, 1]
  ]) {
    const result = runRanger(
      [
        ID.SUMMON_CYCLONE_BOW,
        { type: 'cast', skillId: ID.BLUSTER, ...(interruptMs == null ? {} : { interruptMs }) },
        wait(1000)
      ],
      {
        specialization: 'Galeshot'
      },
      {
        catalog: (catalog) => withSkill(catalog, ID.BLUSTER, { castTimeMs: 2000, windForceApplyMs: 200, effects: [] })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).windForce.value, expected);
  }

  const cancelled = runRanger(
    [ID.SUMMON_CYCLONE_BOW, { type: 'cast', skillId: ID.HAWKEYE, interruptMs: 1 }, wait(2000)],
    {
      specialization: 'Galeshot'
    },
    {
      initialize(runtime) {
        runtime.resourceController.grant('windForce', 5);
      }
    }
  );
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(state(cancelled).windForce.value, 5);
  assert.equal(cancelled.planningState.availability[ID.KEEN_SHOT].ready, false);
  assert.equal(cancelled.planningState.availability[ID.HAWKEYE].ready, true);
});

// Resource conversion belongs to release even without Gale Force, and recovery cannot erase subsequently earned stacks.
test('Hawkeye consumes Wind Force at release without spending later gains again at recovery', () => {
  for (const selectedTraitIds of [[], [TRAIT.GALE_FORCE]]) {
    const seen = [];
    const result = runRanger(
      [ID.SUMMON_CYCLONE_BOW, ID.HAWKEYE, wait(1000)],
      { specialization: 'Galeshot', selectedTraitIds },
      {
        catalog: (catalog) => withSkill(catalog, ID.HAWKEYE, { castTimeMs: 2000, galeForceApplyMs: 400, effects: [] }),
        initialize(runtime) {
          runtime.resourceController.grant('windForce', 5);
        },
        timeline: [{ at: 0.6, run: (runtime) => runtime.resourceController.grant('windForce', 1) }],
        probes: [0.2, 0.4, 0.8, 2].map((at) => [
          at,
          (runtime) => seen.push(runtime.resourceController.value('windForce'))
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(seen, [5, 0, 1, 1]);
  }
});

// Once a cast is eligible for its start action, shortening its animation retains only rewards within that window.
test('eligible shortened casts retain Wind Force only when their grant deadline was reached', () => {
  for (const [effectiveEnd, expected] of [
    [0.1, 0],
    [0.2, 1],
    [0.4, 1]
  ]) {
    const result = runRanger(
      [wait(1000)],
      { specialization: 'Galeshot' },
      {
        initialize(runtime) {
          scheduleWindForce(runtime.mechanics, {
            start: 0,
            fullEnd: 1,
            effectiveEnd,
            skill: { windForceGain: 1, windForceApplyMs: 200 }
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).windForce.value, expected);
  }
});

// Initial state is empty and time alone cannot restore Wind Force, including a disabled zero-cap pool.
test('Wind Force has no passive recovery and isolates selected capacities', () => {
  for (const maximum of [0, 3.5, 7]) {
    const result = runRanger(
      [wait(5000)],
      { specialization: 'Galeshot' },
      {
        catalog: (catalog) => withProfile(catalog, TRAIT.TEACHINGS_OF_THE_TENGU, { minimumStacks: maximum })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).windForce.value, 0);
    assert.equal(state(result).windForce.maximum, maximum);
  }

  assert.equal(state(runRanger([], { specialization: 'Galeshot' })).windForce.maximum, 5);
});

// Completing a hit cycle clears buildup; removing the optional strike cannot remove its earned arrow refund.
test('Shrike resets hit progress and preserves arrow cadence even when its strike is removed', () => {
  for (const removed of [false, true]) {
    const result = runRanger(
      [wait(5000)],
      { specialization: 'Galeshot', initialArrows: 7.5, selectedTraitIds: [TRAIT.SHRIKE] },
      {
        catalog: (catalog) =>
          removed
            ? applyBalanceProfilePatch(catalog, {
                balanceProfiles: { [TRAIT.SHRIKE]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
              })
            : catalog,
        timeline: [
          {
            at: 0.1,
            run(runtime) {
              const current = galeshotState.from(runtime.profession);
              current.missileHits = 13;
              runtime.mechanics.fireTrigger(missileResolved, {
                event: {
                  type: 'damage',
                  at: runtime.time,
                  actorType: 'player',
                  skillName: 'Projectile fixture'
                }
              });
              assert.equal(current.missileHits, 0);
              assert.equal(runtime.resourceController.value('arrows'), 8);
              assert.equal(current.arrows.nextAt, 5);
              runtime.resourceController.spend('arrows', 1);
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).arrows.value, 8);
    assert.equal(state(result).arrows.nextAt, 10);
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.sourceId === TRAIT.SHRIKE),
      !removed
    );
  }
});

// Player and pet controls share one proc deadline; unowned effects cannot claim it or restore arrows.
test('Thrill of the Catch grants patched arrows only for eligible controls outside its cooldown', () => {
  const readings = [];
  const result = runRanger(
    [wait(1000)],
    { specialization: 'Galeshot', initialArrows: 0, selectedTraitIds: [TRAIT.THRILL_OF_THE_CATCH] },
    {
      catalog: (catalog) => withProfile(catalog, TRAIT.THRILL_OF_THE_CATCH, { resourceGain: 2.5 }),
      timeline: [
        [0.1, 'effect'],
        [0.2, 'player'],
        [0.2, 'summon'],
        [0.3, 'player'],
        [0.48, 'summon']
      ].map(([at, actorType]) => ({
        at,
        run(runtime) {
          runtime.mechanics.fireTrigger(galeshotControlAccepted, {
            event: { type: 'control', at, actorType, controlKind: 'daze' }
          });
          readings.push(runtime.resourceController.value('arrows'));
        }
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readings, [0, 2.5, 2.5, 2.5, 5]);
  assert.equal(state(result).arrows.nextAt, 5);
});

test('Galeshot arrow restoration preserves fractional gains and uses the current cap', () => {
  const result = runRanger(
    [],
    { specialization: 'Galeshot' },
    {
      extend: (native) => ({
        catalog: withProfile(native.catalog, TRAIT.TEACHINGS_OF_THE_TENGU, {
          maximumStacks: 4.5,
          pulseInterval: 5
        })
      })
    }
  );
  const runtime = observedRuntime(result);
  const state = runtime.profession.specialization.state;
  state.arrows.value = 2.25;
  runtime.resourceController.grant('arrows', 0.5);
  assert.equal(state.arrows.value, 2.75);
  runtime.resourceController.grant('arrows', 10);
  assert.equal(state.arrows.value, 4.5);
  assert.equal(state.arrows.maximum, 4.5);
});
