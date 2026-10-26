import assert from 'node:assert/strict';
import test from 'node:test';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// The migration leaves actor archetypes shared and rejects obsolete persisted patch targets.
test('Ranger has only actor mechanic profiles and generated trait tuning', () => {
  assert.equal(rangerCatalog.balanceProfiles.filter((profile) => profile.profileKind === 'skill-variant').length, 0);
  assert.equal(rangerCatalog.balanceProfiles.filter((profile) => profile.profileKind === 'mechanic').length, 5);
  for (const id of [
    'ranger.core.sic-em',
    'ranger.druid.resources',
    'ranger.untamed.resources',
    'ranger.galeshot.resources',
    ID.ENDURING_SWING
  ]) {
    assert.throws(
      () => applyBalanceProfilePatch(rangerCatalog, { balanceProfiles: { [id]: { fields: { duration: 1 } } } }),
      /unknown|missing|not found/i
    );
  }
});

// The committed chain finisher reads its skill-owned reward; an uncommitted attempt grants nothing.
test('Enduring Swing grants its selected skill reward only after commitment', () => {
  for (const interrupted of [false, true]) {
    const result = runRanger(
      [
        ID.SLASH_ID_12474,
        ID.SLICE,
        { type: 'cast', skillId: ID.ENDURING_SWING, ...(interrupted ? { interruptMs: 1 } : {}) }
      ],
      {},
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, { skills: { [ID.ENDURING_SWING]: { fields: { resourceGain: 23 } } } }),
        initialize(runtime) {
          runtime.profession.core.endurance.value = 0;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    // Resource state includes ordinary recovery; compare with the same attempt carrying a zero reward.
    const baseline = runRanger(
      [
        ID.SLASH_ID_12474,
        ID.SLICE,
        { type: 'cast', skillId: ID.ENDURING_SWING, ...(interrupted ? { interruptMs: 1 } : {}) }
      ],
      {},
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, { skills: { [ID.ENDURING_SWING]: { fields: { resourceGain: 0 } } } }),
        initialize(runtime) {
          runtime.profession.core.endurance.value = 0;
        }
      }
    );
    assert.equal(
      observedRuntime(result).profession.core.endurance.value -
        observedRuntime(baseline).profession.core.endurance.value,
      interrupted ? 0 : 23
    );
  }
});

// Unlocking-minor policy applies to minimal specialization builds without explicit minor selections.
test('Galeshot capacity and threshold use intrinsic trait tuning', () => {
  const result = runRanger(
    [],
    { specialization: 'Galeshot', selectedTraitIds: [] },
    {
      catalog: (catalog) =>
        applyBalanceProfilePatch(catalog, {
          balanceProfiles: { [TRAIT.TEACHINGS_OF_THE_TENGU]: { fields: { maximumStacks: 11, minimumStacks: 7 } } }
        })
    }
  );
  const state = observedRuntime(result).profession.specialization.state;
  assert.equal(state.arrows.maximum, 11);
  assert.equal(state.windForce.maximum, 7);
});

// The applied pet buff arms its own incarnation; deleting its follow-up preserves the charge and actor ownership.
test('pet venom action payload removal preserves its arming window without an immobilize', () => {
  for (const removed of [false, true]) {
    const result = runRanger(
      [{ type: 'combat-start' }, ID.PARALYZING_VENOM, { type: 'wait', durationMs: 6000 }],
      { selectedPet: 'Jungle Spider' },
      {
        catalog: (catalog) =>
          removed
            ? applySkillPatch(catalog, {
                skills: {
                  [ID.PARALYZING_VENOM]: {
                    sideEffects: { 'paralyzing-venom': { removeEffects: [{ type: 'condition', name: 'Immobilized' }] } }
                  }
                }
              })
            : catalog
      }
    );
    assert.deepEqual(result.warnings, []);
    const children = result.events.filter(
      (event) => event.skillId === ID.PARALYZING_VENOM && event.type === 'condition'
    );
    assert.equal(children.length > 0, !removed);
    assert.ok(result.events.some((event) => event.kind === 'paralyzing-venom'));
    for (const child of children) {
      assert.equal(child.actorType, 'summon');
      assert.ok(child.summonOwner);
    }

    if (removed) assert.equal(observedRuntime(result).profession.core.pet.paralyzingVenom.charges, 1);
  }
});
