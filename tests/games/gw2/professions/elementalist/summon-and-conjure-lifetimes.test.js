import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { openElementalistEtching } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { tempestOverloadDwell } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overload-dwell.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise selected patch owners through the same catalog boundary used by runtime and authoring.
function preview(skills, balanceProfiles = {}) {
  return withPatchPreview(elementalistProfession, {
    id: 'mechanic-ownership',
    label: 'Mechanic ownership',
    professions: {
      elementalist: {
        skills: Object.fromEntries(Object.entries(skills).map(([id, fields]) => [id, { fields }])),
        balanceProfiles
      }
    }
  });
}

test('each elemental glyph owns configured and explicit summon lifetime, startup, and post-expiry recharge', () => {
  const variants = [
    [ID.GLYPH_OF_ELEMENTALS, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 2, 5],
    [ID.GLYPH_OF_ELEMENTALS_EARTH, ID.STOMP_ELEMENTAL_COMMAND, 3, 7]
  ];
  const profession = preview(
    Object.fromEntries(
      variants.map(([id, , duration, rechargeAfterExpiry]) => [
        id,
        { duration, rechargeAfterExpiry, summonStartupDelay: 20 }
      ])
    )
  );
  for (const [id, command, duration, recharge] of variants) {
    for (const explicit of [false, true]) {
      const result = runElementalist(
        [explicit ? cast(id) : { type: 'combat-start' }, wait(5000)],
        {
          patchId: 'mechanic-ownership',
          selectedSkillIds: [id],
          selectedTraitIds: []
        },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      const expiry = result.events.find((event) => event.sourceId === 'elementalist.elemental-expire');
      const action = result.events.find((event) => event.type === 'action' && event.skillId === id);
      assert.equal(expiry.at, (explicit ? action.endsAt : 0) + duration);
      assert.equal(result.planningState.profession[STATE.SUMMONED_ELEMENTAL].element, null);
      assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][command], undefined);
      assert.equal(observedRuntime(result).cooldownController.readyAt(id), expiry.at + recharge / 1.25);
      // A summon that expires before target acquisition cannot begin autonomous attacks.
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.actorType === 'summon'),
        false
      );
    }
  }
});

test('each conjure owns ground expiry and the fresh lifetime granted by its pickup', () => {
  const variants = [
    [ID.CONJURE_FROST_BOW, ID.PICK_UP_FROST_BOW, 'Frost Bow', 4],
    [ID.CONJURE_LIGHTNING_HAMMER, ID.PICK_UP_LIGHTNING_HAMMER, 'Lightning Hammer', 6],
    [ID.CONJURE_FIERY_GREATSWORD, ID.PICK_UP_FIERY_GREATSWORD, 'Fiery Greatsword', 8]
  ];
  const profession = preview(Object.fromEntries(variants.map(([id, , , duration]) => [id, { duration }])));
  for (const [id, pickup, weapon, duration] of variants) {
    const config = { patchId: 'mechanic-ownership', selectedSkillIds: [id], selectedTraitIds: [] };
    const initial = runElementalist([cast(id)], config, { profession });
    assert.deepEqual(initial.warnings, []);
    const conjure = initial.events.find((event) => event.type === 'action' && event.skillId === id);
    assert.equal(initial.planningState.profession[STATE.CONJURE_PICKUPS][weapon], conjure.endsAt + duration);
    assert.equal(initial.planningState.profession[STATE.CONJURE_EXPIRES_AT], conjure.endsAt + duration);
    const picked = runElementalist([cast(id), wait(1000), cast(ID.DROP_BUNDLE), cast(pickup), wait(1000)], config, {
      profession
    });
    assert.deepEqual(picked.warnings, []);
    const action = picked.events.find((event) => event.type === 'action' && event.skillId === pickup);
    assert.equal(picked.planningState.profession[STATE.CONJURE_EQUIPPED], weapon);
    assert.equal(picked.planningState.profession[STATE.CONJURE_PICKUPS][weapon], undefined);
    assert.equal(picked.planningState.profession[STATE.CONJURE_EXPIRES_AT], action.endsAt + duration);
  }
});

test('selected spear bonuses preserve one-shot acceptance while etchings always require three credits', () => {
  const roots = elementalistCatalog.skills.filter((skill) => skill.etchingReleases);
  const profession = preview({
    [ID.SEETHE]: { nextSkillDamageMultiplier: 1.7 },
    [ID.RIPPLE]: { nextSkillRechargeMultiplier: 0.4 }
  });
  const context = observedRuntime(runElementalist([], { patchId: 'mechanic-ownership' }, { profession })).mechanics;
  const core = context.profession.core;
  const skill = context.helpers.skillsById.get(ID.BLAZING_BARRAGE);
  core.spearNextDamageBonus = true;
  const first = { id: 'first', skill };
  elementalistCoreHooks.onCastStart(context, first);
  elementalistCoreHooks.onCastStart(context, { id: 'second', skill });
  assert.equal(core.spearNextDamageBonus, false);
  assert.equal(core.spearFollowups.second, undefined);
  // Preparation selects its activation's accepted bonus; retiring that cast cannot erase an already prepared packet.
  const packet = { type: 'damage', coefficient: 2, activationId: first.id };
  const prepared = elementalistCoreHooks.prepareEvent(context, packet);
  assert.equal(prepared.coefficient, 2);
  assert.equal(prepared.metadata.elementalistSeetheDamageFactor, 1.7);
  assert.equal(elementalistCoreHooks.prepareEvent(context, { ...packet, activationId: 'second' }).metadata, undefined);
  elementalistCoreHooks.onCastCommit(context, first);
  assert.equal(elementalistCoreHooks.prepareEvent(context, packet).metadata, undefined);
  assert.equal(prepared.metadata.elementalistSeetheDamageFactor, 1.7);
  core.spearNextRechargeReduction = true;
  assert.equal(elementalistCoreHooks.reserveRecharge(context, context.helpers.skillsById.get(ID.FLAME_SPEAR), 10), 10);
  assert.equal(core.spearNextRechargeReduction, true);
  assert.equal(elementalistCoreHooks.reserveRecharge(context, skill, 10), 4);
  assert.equal(elementalistCoreHooks.reserveRecharge(context, skill, 10), 10);
  // Balance previews can change spear bonuses without changing etching progression.
  for (const entry of roots) {
    const root = context.helpers.skillsById.get(entry.id);
    openElementalistEtching(context, root);
    for (let credit = 0; credit < 2; credit++) elementalistCoreHooks.onCastCommit(context, { id: 'credit', skill });
    assert.equal(core.etchings[root.name].stage, 'lesser');
    elementalistCoreHooks.onCastCommit(context, { id: 'credit', skill });
    assert.equal(core.etchings[root.name].stage, 'full');
  }
});

test('Singularity owns baseline dwell and Transcendent Tempest independently overrides it', () => {
  const profession = preview(
    {},
    {
      [TRAIT.SINGULARITY]: { fields: { duration: 9 } },
      [TRAIT.TRANSCENDENT_TEMPEST]: { fields: { duration: 5 } }
    }
  );
  for (const patchId of ['current', 'mechanic-ownership', 'current']) {
    const balance = profession.resolvePatch({ id: patchId }).balanceContext;
    for (const selectedTraitIds of [[], [TRAIT.SINGULARITY], [TRAIT.TRANSCENDENT_TEMPEST]]) {
      const shortened = selectedTraitIds.includes(TRAIT.TRANSCENDENT_TEMPEST);
      const duration = patchId === 'current' ? (shortened ? 4 : 6) : shortened ? 5 : 9;
      assert.equal(
        tempestOverloadDwell({ ...balance, config: { specialization: 'Tempest', selectedTraitIds } }.catalog, {
          ...balance,
          config: { specialization: 'Tempest', selectedTraitIds }
        }),
        duration / 1.25
      );
      const result = runElementalist(
        [cast(ID.FIRE_ATTUNEMENT), cast(ID.OVERLOAD_FIRE)],
        { patchId, specialization: 'Tempest', startAttunement: 'Water', selectedTraitIds },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.find((event) => event.type === 'action' && event.skillId === ID.OVERLOAD_FIRE).at,
        duration / 1.25
      );
    }
  }
});

test('removed shared mechanic targets reject patches instead of redirecting them to new owners', () => {
  for (const id of [
    'elementalist.core.summoned-elemental',
    'elementalist.core.conjure-pickups',
    'elementalist.core.spear-empowerments',
    'elementalist.tempest.overloads'
  ]) {
    assert.throws(
      () => applyBalanceProfilePatch(elementalistCatalog, { balanceProfiles: { [id]: { fields: { duration: 1 } } } }),
      /unknown balance profile/
    );
  }
});
