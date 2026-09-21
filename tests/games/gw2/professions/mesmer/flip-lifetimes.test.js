import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { completeMesmerCast } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { advanceMesmerScheduler } from '#gw2/professions/mesmer/core/execution/scheduler-hooks.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// Exercise the shared flip lifecycle without depending on a weapon's calibrated cast duration.
function flipContext() {
  const parent = { id: ID.ILLUSIONARY_COUNTER, name: 'Illusionary Counter' };
  const flip = {
    id: ID.COUNTERSPELL,
    name: 'Counterspell',
    flipParentId: parent.id,
    flipDelay: 0.1,
    flipDuration: 0.2
  };
  const skillsById = new Map([parent, flip].map((skill) => [skill.id, skill]));
  return {
    parent,
    flip,
    config: {},
    start: 0.1 + 0.2,
    fullEnd: 0.35,
    effectiveEnd: 0.35,
    action: {},
    reservationId: 'parent',
    inFlight: new Map(),
    maximumAmmoFor: () => 0,
    state: {
      time: 0.35,
      activeWeaponSet: 1,
      profession: { core: createMesmerCoreState(), specialization: { kind: 'Core', state: {} } }
    },
    catalog: { skillsById, autoattackChains: [] },
    mesmerRuntime: {
      skillsById,
      flipSkillsByParent: new Map([[parent.id, flip]]),
      castDetails: new Map(),
      skillCompletionHandlers: [],
      shatters: {},
      resourceDefinition: { singular: 'clone', plural: 'clones', maximum: 3 },
      skillEffects: { scheduleResources() {}, complete() {} }
    }
  };
}

test('Mesmer flip creation, availability, projection, and cleanup share exact boundaries', () => {
  const context = flipContext();
  completeMesmerCast(context, context.parent);
  const core = context.state.profession.core;
  assert.deepEqual(core.availableFlips[ID.COUNTERSPELL], {
    identity: 'parent',
    visibleAt: 0.35,
    availableAt: 0.4,
    expiresAt: 0.5
  });
  for (const [at, ready, code] of [
    [0.399999, false, 'mesmer.flip-not-ready'],
    [0.4, true],
    [0.499999, true],
    [0.5, false, 'mesmer.flip-not-armed']
  ]) {
    context.start = context.state.time = at;
    const availability = mesmerAvailability(context, context.flip);
    assert.equal(availability.ready, ready, `availability at ${at}`);
    assert.equal(availability.code, code);
    // Delayed flips remain listed for inspection, but expired flips must disappear before cleanup runs.
    assert.equal(
      Boolean(projectMesmerPlanningState({ schedulerContext: context }).availableFlips[ID.COUNTERSPELL]),
      at < 0.5
    );
  }

  advanceMesmerScheduler(context, 0.499999);
  assert.ok(core.availableFlips[ID.COUNTERSPELL]);
  advanceMesmerScheduler(context, 0.5);
  assert.equal(core.availableFlips[ID.COUNTERSPELL], undefined);
});

test('Mesmer completion cannot arm an already expired flip and cleanup preserves persistent flips', () => {
  const context = flipContext();
  context.fullEnd = context.effectiveEnd = 0.5;
  completeMesmerCast(context, context.parent);
  assert.equal(context.state.profession.core.availableFlips[ID.COUNTERSPELL], undefined);
  context.state.profession.core.availableFlips[ID.POWER_SPIKE] = armSkillFlip({}, 0, 0, Infinity);
  advanceMesmerScheduler(context, 100);
  assert.equal(context.state.profession.core.availableFlips[ID.POWER_SPIKE].expiresAt, null);
});

test('Mesmer flip endpoints canonicalize arithmetic residue without snapping to action ticks', () => {
  const context = flipContext();
  context.start = 0.1;
  context.fullEnd = context.effectiveEnd = 0.15;
  context.flip.flipDelay = 0.2;
  context.flip.flipDuration = 0.333333;
  completeMesmerCast(context, context.parent);
  assert.deepEqual(context.state.profession.core.availableFlips[ID.COUNTERSPELL], {
    identity: 'parent',
    visibleAt: 0.15,
    availableAt: 0.3,
    expiresAt: 0.433333
  });
});
