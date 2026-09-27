import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as GUARDIAN, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

// The shared emitter must retain the trait's identity and cast lineage alongside the independent page refund.
test('Weighty Terms side effects preserve Slow attribution and page restoration', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    specialization: 'Firebrand',
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.WEIGHTY_TERMS],
    initialTomePages: 0,
    boons: {},
    target: { armor: 2597 }
  })(undefined, ['Flame Rush', 'Flame Rush', { type: 'wait', durationMs: 1000 }, 'Flame Surge']);
  assert.deepEqual(result.warnings, []);
  const slow = result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.WEIGHTY_TERMS);
  const cast = result.events.find((event) => event.type === 'action' && event.skillId === GUARDIAN.FLAME_SURGE);
  assert.equal(slow.length, 1);
  assert.equal(slow[0].name, 'Weighty Terms — Slow');
  assert.equal(slow[0].activationId, cast.activationId);
  assert.equal(slow[0].at, cast.endsAt);
  assert.equal(result.planningState.profession.tomePages.value, 2);
});

// Outcome selection must spend Luck once and preserve the selected profile's schedule even on cancelled uses.
test('Cannon variants retain accepted outcomes, live profile timing, and cancelled-use packets', () => {
  for (const [recharging, luck, cancelled] of [
    [false, 0, false],
    [true, 0, false],
    [true, 1, false],
    [true, 0, true],
    [false, 0, true]
  ]) {
    const backfire = recharging && !luck;
    const result = runThief(
      [
        {
          skillId: THIEF.STONE_SUMMIT_CANNON,
          type: 'cast',
          doubleEdgeOutcome: 'backfire',
          ...(cancelled ? { interruptAfterMs: 100 } : {})
        },
        { type: 'wait', durationMs: 3500 }
      ],
      { specialization: 'Antiquary', selectedSkills: ['Stone Summit Cannon'] },
      {
        initialize(runtime) {
          if (recharging) runtime.cooldownController.setReadyAt(THIEF.STONE_SUMMIT_CANNON, 15);
          runtime.profession.specialization.state.scoundrelsLuck = luck;
        },
        catalog: (catalog) =>
          withProfile(
            withProfile(catalog, PROFILE.cannonSuccess, {
              effects: [{ type: 'strike', coefficient: 1, atMs: 130 }]
            }),
            PROFILE.cannonBackfire,
            {
              initialDelay: 0.7,
              effects: [{ type: 'strike', coefficient: 2, atMs: 130 }]
            }
          )
      }
    );
    assert.deepEqual(result.warnings, []);
    const action = result.events.find(
      (event) => event.type === 'action' && event.skillId === THIEF.STONE_SUMMIT_CANNON
    );
    const strikes = result.events.filter(
      (event) => event.type === 'damage' && event.skillId === THIEF.STONE_SUMMIT_CANNON
    );
    assert.equal(strikes.length, 1);
    assert.equal(strikes[0].coefficient, backfire ? 2 : 1);
    assert.ok(Math.abs(strikes[0].at - (action.endsAt + 0.13 + (backfire ? 0.7 : 0))) < 1e-6);
    assert.equal(strikes[0].activationId, action.activationId);
    assert.equal(observedRuntime(result).profession.specialization.state.scoundrelsLuck, 0);
  }
});

// Commitment clears both recharge stores once; deferred completion cannot reset a newly started recharge.
test('Mental Collapse resets recharge at commitment and never repeats the reset at the reserved end', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  const pending = [];
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, MESMER.MENTAL_COLLAPSE, { castTimeMs: 1000, interruptCommitMs: 400 }),
      initialize(runtime) {
        native.initialize(runtime);
        runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(MESMER.MIND_THE_GAP), 0, 50);
        runtime.schedule('test.reset-probe', 0.25);
        runtime.schedule('test.reset-probe', 0.75);
        runtime.schedule('test.restart-recharge', 0.8);
        runtime.schedule('test.reset-probe', 1.05);
      },
      tasks: {
        ...native.tasks,
        'test.reset-probe'(runtime) {
          const recharging = runtime.cooldowns.has(MESMER.MIND_THE_GAP);
          assert.equal(runtime.rechargeProgress.has(MESMER.MIND_THE_GAP), recharging);
          pending.push(recharging);
        },
        'test.restart-recharge': (runtime) =>
          runtime.cooldownController.startRecharge(
            runtime.helpers.skillsById.get(MESMER.MIND_THE_GAP),
            runtime.time,
            50
          )
      }
    },
    config,
    rotation: [
      { type: 'cast', skillId: MESMER.MENTAL_COLLAPSE, interruptAfterMs: 500 },
      { type: 'wait', durationMs: 1000 }
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(pending, [true, false, true]);
});

// Removing the authored control must remove the empowered stun without removing consumption or the recharge reset.
test('Mental Collapse uses its normal effect list for the Clarity-gated stun', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, MESMER.MENTAL_COLLAPSE, {
        effects: native.catalog.skillsById
          .get(MESMER.MENTAL_COLLAPSE)
          .effects.filter((effect) => effect.type !== 'control')
      })
    },
    config,
    rotation: ['Mind the Gap', 'Mental Collapse', { type: 'wait', durationMs: 1000 }]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'control' && event.skillId === MESMER.MENTAL_COLLAPSE),
    false
  );
  assert.equal(result.planningState.profession.clarityRemaining, 0);
  assert.equal(observedRuntime(result).cooldowns.has(MESMER.MIND_THE_GAP), false);
});

// Clarity's live skill effect is the sole source of its window and proc; removal or cancellation grants neither.
test('Mind the Gap applies its authored Clarity duration and respects effect removal and cancellation', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Spear',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597 }
  };
  const native = mesmerProfession.runtimeFor(config);
  for (const [removed, cancelled] of [
    [false, false],
    [true, false],
    [false, true]
  ]) {
    const result = observeGw2Runtime({
      profession: {
        ...native,
        catalog: withSkill(native.catalog, MESMER.MIND_THE_GAP, {
          effects: native.catalog.skillsById
            .get(MESMER.MIND_THE_GAP)
            .effects.flatMap((effect) =>
              effect.kind === 'clarity' ? (removed ? [] : [{ ...effect, duration: 2 }]) : [effect]
            )
        })
      },
      config,
      rotation: [
        { type: 'cast', skillId: MESMER.MIND_THE_GAP, ...(cancelled ? { interruptAfterMs: 100 } : {}) },
        { type: 'wait', durationMs: 1000 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.clarityRemaining, removed || cancelled ? 0 : 1000);
    const proc = result.events.find((event) => event.type === 'proc' && event.name === 'Clarity');
    assert.equal(Boolean(proc), !removed && !cancelled);
    if (proc) assert.equal(proc.detail, 'Spear skills 3-5 empowered for 2s');
  }
});
