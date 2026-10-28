import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const config = {
  specialization: 'Harbinger',
  initialResource: 100,
  initialBlight: 20,
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });

// Removing an empowered component cannot cancel the skill's independently owned resource transaction.
for (const id of [
  ID.ELIXIR_OF_PROMISE,
  ID.ELIXIR_OF_RISK,
  ID.ELIXIR_OF_BLISS,
  ID.ELIXIR_OF_IGNORANCE,
  ID.ELIXIR_OF_ANGUISH,
  ID.ELIXIR_OF_AMBITION,
  ID.DEVOURING_CUT,
  ID.VORACIOUS_ARC
]) {
  test(`skill ${id} owns empowered removal and Blight settlement`, () => {
    const native = necromancerProfession.runtimeFor(config);
    const skill = native.catalog.skillsById.get(id);
    const elixir = skill.categories.includes('Elixir');
    const action = requireSkillAction(skill, 'empowered');
    const catalog = applySkillPatch(native.catalog, {
      skills: {
        [id]: {
          fields: { blightCost: 1, ...(elixir ? { blightGain: 2 } : {}) },
          sideEffects: { empowered: { removeEffects: action.effects.map(({ type, name }) => ({ type, name })) } }
        }
      }
    });
    const result = observeGw2Runtime({
      profession: { ...native, catalog },
      config,
      rotation: [...(elixir ? [] : [cast(ID.HARBINGER_SHROUD)]), cast(id)]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.specialization.state.blightExpiries.length, elixir ? 21 : 19);
    assert.equal(
      result.events.some((event) => event.skillId === id && ['damage', 'condition'].includes(event.type)),
      false
    );
    assert.equal(
      requireSkillAction(native.catalog.skillsById.get(id), 'empowered').effects.length,
      action.effects.length
    );
  });
}

// Intrinsic resource policy uses the generated minor profile even without explicit trait selections.
test('Dark Disciple owns patchable Blight capacity, growth cadence, and drain', () => {
  const settings = { ...config, initialBlight: 0, selectedTraitIds: [] };
  const native = necromancerProfession.runtimeFor(settings);
  const catalog = applyBalanceProfilePatch(native.catalog, {
    balanceProfiles: {
      [TRAIT.DARK_DISCIPLE]: {
        fields: { maximumStacks: 4, blightGain: 3, pulseInterval: 0.5, lifeForceDrain: 1 }
      }
    }
  });
  const result = observeGw2Runtime({
    profession: { ...native, catalog },
    config: settings,
    rotation: [cast(ID.HARBINGER_SHROUD), { type: 'wait', durationMs: 1000 }]
  });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.specialization.state.blightExpiries.length, 4);
  assert.equal(runtime.profession.core.lifeForce.value / runtime.profession.core.lifeForce.maximum, 0.99);
});

// Decimal cadence must advance the scheduler and grant resources after entry on a fractional boundary.
for (const entryDelayMs of [0, 300]) {
  test(`fractional Blight cadence advances after shroud entry at ${entryDelayMs}ms`, () => {
    const settings = { ...config, initialBlight: 0, selectedTraitIds: [] };
    const native = necromancerProfession.runtimeFor(settings);
    const catalog = applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: { [TRAIT.DARK_DISCIPLE]: { fields: { pulseInterval: 0.1, lifeForceDrain: 0 } } }
    });
    const result = observeGw2Runtime({
      profession: { ...native, catalog },
      config: settings,
      rotation: [
        ...(entryDelayMs ? [{ type: 'wait', durationMs: entryDelayMs }] : []),
        cast(ID.HARBINGER_SHROUD),
        { type: 'wait', durationMs: 1000 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const state = runtime.profession.specialization.state;
    assert.equal(state.blightExpiries.length, 20);
    assert.ok(state.nextBlightAt > runtime.time);
  });
}

// Disabling resource generation must not cancel expiration of stacks already held on entry.
test('zero Blight cadence leaves existing stack expiry active', () => {
  const native = necromancerProfession.runtimeFor(config);
  const catalog = applyBalanceProfilePatch(native.catalog, {
    balanceProfiles: { [TRAIT.DARK_DISCIPLE]: { fields: { pulseInterval: 0, lifeForceDrain: 0 } } }
  });
  const result = observeGw2Runtime({
    profession: { ...native, catalog },
    config,
    rotation: [cast(ID.HARBINGER_SHROUD), { type: 'wait', durationMs: 30000 }]
  });
  assert.deepEqual(result.warnings, []);
  const state = observedRuntime(result).profession.specialization.state;
  assert.deepEqual(state.blightExpiries, []);
  assert.equal(state.nextBlightAt, Infinity);
});

// A positive interval below clock precision must fail instead of repeatedly scheduling the same instant.
test('Blight cadence rejects intervals smaller than the canonical clock', () => {
  const native = necromancerProfession.runtimeFor(config);
  const catalog = applyBalanceProfilePatch(native.catalog, {
    balanceProfiles: { [TRAIT.DARK_DISCIPLE]: { fields: { pulseInterval: 1e-9 } } }
  });
  assert.throws(
    () => observeGw2Runtime({ profession: { ...native, catalog }, config, rotation: [cast(ID.HARBINGER_SHROUD)] }),
    /Recurring intervals must span at least one canonical microsecond/
  );
});

// Removed profile IDs reject edits instead of silently accepting a stale patch target.
test('obsolete intrinsic profiles are absent and reject patch edits', () => {
  const catalog = necromancerProfession.catalog;
  for (const id of [
    'necromancer.ritualist.spirit-cadence',
    'necromancer.ritualist.painful-bond',
    'necromancer.harbinger.resources',
    'necromancer.reaper.resources',
    'necromancer.scourge.shade',
    'necromancer.core.addle-daze',
    'necromancer.core.signet-of-spite-passive',
    'necromancer.core.minion.bone-fiend',
    'necromancer.ritualist.resources',
    'necromancer.ritualist.spirit.anguish',
    'necromancer.ritualist.nightmare-weapon-proc'
  ]) {
    assert.throws(
      () => applyBalanceProfilePatch(catalog, { balanceProfiles: { [id]: { fields: {} } } }),
      /unknown balance profile/
    );
  }
});
