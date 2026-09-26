import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { settleMesmerSkillFlips } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerCoreLive } from '#gw2/professions/mesmer/core/live.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { MESMER_CORE_BALANCE_PROFILES } from '#gw2/professions/mesmer/core/profiles.js';
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
  const context = {
    parent,
    flip,
    config: {},
    start: 0.1 + 0.2,
    fullEnd: 0.35,
    effectiveEnd: 0.35,
    action: {},
    reservationId: 'parent',
    inFlight: new Map(),
    cooldownController: { ensureAmmo: () => null },
    schedule() {},
    state: {
      time: 0.35,
      activeWeaponSet: 1,
      profession: { core: createMesmerCoreState(), specialization: { kind: 'Core', state: {} } }
    },
    catalog: {
      skillsById,
      autoattackChains: [],
      balanceProfilesById: new Map(MESMER_CORE_BALANCE_PROFILES.map((profile) => [profile.id, profile]))
    },
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
  Object.assign(context, context.state);
  context.helpers = context.catalog;
  registerMesmerMechanics(context, context.mesmerRuntime);
  return context;
}

test('Mesmer flip creation, availability, projection, and cleanup share exact boundaries', () => {
  const context = flipContext();
  settleMesmerSkillFlips(context, { ...context, id: 'parent' }, context.parent, context.effectiveEnd);
  const core = context.profession.core;
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
    context.start = context.time = at;
    const availability = mesmerAvailability(context, context.flip);
    assert.equal(availability.ready, ready, `availability at ${at}`);
    assert.equal(availability.code, code);
    // Delayed flips remain listed for inspection, but expired flips must disappear before cleanup runs.
    assert.equal(
      Boolean(
        projectMesmerPlanningState({ ...context, config: context.config, catalog: context.catalog }).availableFlips[
          ID.COUNTERSPELL
        ]
      ),
      at < 0.5
    );
  }

  assert.ok(core.availableFlips[ID.COUNTERSPELL]);
  mesmerCoreLive.tasks['mesmer.flip-expire'](context, { id: ID.COUNTERSPELL, identity: 'parent' });
  assert.equal(core.availableFlips[ID.COUNTERSPELL], undefined);
});

test('Mesmer completion cannot arm an already expired flip and cleanup preserves persistent flips', () => {
  const context = flipContext();
  context.fullEnd = context.effectiveEnd = 0.5;
  settleMesmerSkillFlips(context, { ...context, id: 'parent' }, context.parent, context.effectiveEnd);
  assert.equal(context.profession.core.availableFlips[ID.COUNTERSPELL], undefined);
  context.profession.core.availableFlips[ID.POWER_SPIKE] = armSkillFlip({}, 0, 0, Infinity);

  assert.equal(context.profession.core.availableFlips[ID.POWER_SPIKE].expiresAt, null);
});

test('Mesmer flip endpoints canonicalize arithmetic residue without snapping to action ticks', () => {
  const context = flipContext();
  context.start = 0.1;
  context.fullEnd = context.effectiveEnd = 0.15;
  context.flip.flipDelay = 0.2;
  context.flip.flipDuration = 0.333333;
  settleMesmerSkillFlips(context, { ...context, id: 'parent' }, context.parent, context.effectiveEnd);
  assert.deepEqual(context.profession.core.availableFlips[ID.COUNTERSPELL], {
    identity: 'parent',
    visibleAt: 0.15,
    availableAt: 0.3,
    expiresAt: 0.433333
  });
});
