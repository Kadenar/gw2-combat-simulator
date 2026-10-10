import { missileResolved } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotControlAccepted } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { scheduleWindForce } from '#gw2/professions/ranger/specializations/galeshot/skills/index.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => galeshotState.from(observedRuntime(result));

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
        withSkill(withProfile(catalog, PROFILE.resources, { minimumStacks: 2.5 }), ID.BLUSTER, {
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
            galeshotState.from(runtime).cycloneBowActive
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
  assert.equal(state(result).windForce.rate, 0);
  assert.deepEqual(result.planningState.profession.windForce, state(result).windForce);
  assert.notEqual(result.planningState.profession.windForce, state(result).windForce);
});

// Cast cancellation retains its original grant gate, and Hawkeye clears the full pool at its accepted start.
test('Wind Force respects interrupted casts and Hawkeye resets', () => {
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

  const reset = runRanger(
    [ID.SUMMON_CYCLONE_BOW, { type: 'cast', skillId: ID.HAWKEYE, interruptMs: 1 }],
    {
      specialization: 'Galeshot'
    },
    {
      initialize(runtime) {
        runtime.resourceController.grant('windForce', 5);
      }
    }
  );
  assert.deepEqual(reset.warnings, []);
  assert.equal(state(reset).windForce.value, 0);
  assert.equal(reset.planningState.availability[ID.KEEN_SHOT].ready, true);
  assert.equal(reset.planningState.availability[ID.HAWKEYE].ready, false);
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
        catalog: (catalog) => withProfile(catalog, PROFILE.resources, { minimumStacks: maximum })
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
              const current = galeshotState.from(runtime);
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
