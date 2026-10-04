import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { armMesmerSkillFlip } from '#gw2/professions/mesmer/core/mechanics/flips.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { MESMER_CORE_BALANCE_PROFILES } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// Exercise the shared flip lifecycle without depending on a weapon's calibrated cast duration.
function flipContext() {
  const parent = {
    id: ID.ILLUSIONARY_COUNTER,
    name: 'Illusionary Counter',
    flipArm: { skillId: ID.COUNTERSPELL, delay: 0.1, duration: 0.2 }
  };
  const flip = {
    id: ID.COUNTERSPELL,
    name: 'Counterspell',
    flipParentId: parent.id
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
    castController: { hasInFlight: () => false },
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
      castDetails: new Map(),
      shatters: {},
      resourceDefinition: { singular: 'clone', plural: 'clones', maximum: 3 },
      skillEffects: { scheduleResources() {} }
    }
  };
  Object.assign(context, context.state);
  context.helpers = context.catalog;
  registerMesmerMechanics(context, context.mesmerRuntime);
  return context;
}

test('Mesmer flip creation, availability, projection, and cleanup share exact boundaries', () => {
  const context = flipContext();
  context.time = context.effectiveEnd;
  armMesmerSkillFlip(context, { ...context, id: 'parent', skill: context.parent });
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
        projectObservedState(mesmerProfession, { ...context, config: context.config, catalog: context.catalog })
          .availableFlips[ID.COUNTERSPELL]
      ),
      at < 0.5
    );
  }

  assert.ok(core.availableFlips[ID.COUNTERSPELL]);
  mesmerCoreHooks.tasks['mesmer.flip-expire'](context, { id: ID.COUNTERSPELL, identity: 'parent' });
  assert.equal(core.availableFlips[ID.COUNTERSPELL], undefined);
});

test('Mesmer completion cannot arm an already expired flip and cleanup preserves persistent flips', () => {
  const context = flipContext();
  context.fullEnd = context.effectiveEnd = 0.5;
  context.time = context.effectiveEnd;
  armMesmerSkillFlip(context, { ...context, id: 'parent', skill: context.parent });
  assert.equal(context.profession.core.availableFlips[ID.COUNTERSPELL], undefined);
  context.profession.core.availableFlips[ID.POWER_SPIKE] = armSkillFlip({}, 0, 0, Infinity);

  assert.equal(context.profession.core.availableFlips[ID.POWER_SPIKE].expiresAt, null);
});

test('Mesmer flip endpoints canonicalize arithmetic residue without snapping to action ticks', () => {
  const context = flipContext();
  context.start = 0.1;
  context.fullEnd = context.effectiveEnd = 0.15;
  context.parent.flipArm.delay = 0.2;
  context.parent.flipArm.duration = 0.333333;
  context.time = context.effectiveEnd;
  armMesmerSkillFlip(context, { ...context, id: 'parent', skill: context.parent });
  assert.deepEqual(context.profession.core.availableFlips[ID.COUNTERSPELL], {
    identity: 'parent',
    visibleAt: 0.15,
    availableAt: 0.3,
    expiresAt: 0.433333
  });
});
