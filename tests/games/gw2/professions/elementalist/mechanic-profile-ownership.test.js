import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import {
  beginElementalistSpearCast,
  empowerElementalistSpearPacket,
  openElementalistEtching,
  completeElementalistSpearProgression
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { reserveElementalistRecharge } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { tempestOverloadDwell } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overload-dwell.js';
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

const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
function facts(balance, id) {
  const tooltip = describeSimulationSkill(balance, balance.catalog.skillsById.get(id), elementalistTooltips);
  assert.equal(tooltip.incomplete, false);
  return Object.fromEntries(tooltip.facts.map(({ name, detail }) => [name, detail]));
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

    const balance = profession.resolvePatch({ id: 'mechanic-ownership' }).balanceContext;
    assert.equal(facts(balance, id)['Elemental lifetime'], `${duration}s`);
    assert.equal(facts(balance, id)['Recharge after expiry'], `${recharge}s`);
    assert.equal(balance.catalog.skillsById.get(id).cooldown, elementalistCatalog.skillsById.get(id).cooldown);
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
    const balance = profession.resolvePatch({ id: 'mechanic-ownership' }).balanceContext;
    assert.equal(facts(balance, id)['Ground pickup lifetime'], `${duration}s`);
  }
});

test('selected spear owners preserve one-shot acceptance and independent etching thresholds', () => {
  const profession = preview({
    [ID.SEETHE]: { nextSkillDamageMultiplier: 1.7 },
    [ID.RIPPLE]: { nextSkillRechargeMultiplier: 0.4 },
    ...Object.fromEntries(
      ETCHING_CHAINS.map(({ etchingId }, index) => [etchingId, { etchingCompletionThreshold: index + 1 }])
    )
  });
  const balance = profession.resolvePatch({ id: 'mechanic-ownership' }).balanceContext;
  const core = createElementalistCoreState();
  const context = { helpers: balance.catalog, profession: { core }, time: 0, schedule() {} };
  const skill = balance.catalog.skillsById.get(ID.BLAZING_BARRAGE);
  core.spearNextDamageBonus = true;
  const first = { id: 'first' };
  beginElementalistSpearCast(context, first, skill);
  beginElementalistSpearCast(context, { id: 'second' }, skill);
  assert.equal(core.spearNextDamageBonus, false);
  assert.equal(core.spearFollowups.second, undefined);
  // A delayed sequence can retain the accepted bonus after later casts have begun.
  const captured = { ...core.spearFollowups.first };
  const packet = { type: 'damage', coefficient: 2 };
  assert.equal(empowerElementalistSpearPacket(context, packet, captured).coefficient, 3.4);
  assert.equal(empowerElementalistSpearPacket(context, packet, core.spearFollowups.second).coefficient, 2);
  core.spearNextRechargeReduction = true;
  assert.equal(reserveElementalistRecharge(context, balance.catalog.skillsById.get(ID.FLAME_SPEAR), 10), 10);
  assert.equal(core.spearNextRechargeReduction, true);
  assert.equal(reserveElementalistRecharge(context, skill, 10), 4);
  assert.equal(reserveElementalistRecharge(context, skill, 10), 10);
  for (const [index, chain] of ETCHING_CHAINS.entries()) {
    const root = balance.catalog.skillsById.get(chain.etchingId);
    openElementalistEtching(context, root);
    for (let credit = 0; credit < index; credit++) completeElementalistSpearProgression(context, skill);
    assert.equal(core.etchings[chain.etching].stage, 'lesser');
    completeElementalistSpearProgression(context, skill);
    assert.equal(core.etchings[chain.etching].stage, 'full');
    assert.equal(facts(balance, root.id)['Completed actions to fully charge'], String(index + 1));
  }

  assert.equal(facts(balance, ID.SEETHE)["Next eligible skill's strike damage"], '+70%');
  assert.equal(facts(balance, ID.RIPPLE)["Next eligible skill's recharge"], '-60%');
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
        tempestOverloadDwell({ ...balance, config: { specialization: 'Tempest', selectedTraitIds } }),
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

    const model = describeSimulationTrait(
      balance,
      balance.catalog.traits.find((trait) => trait.id === TRAIT.SINGULARITY),
      elementalistTooltips
    );
    assert.equal(
      model.facts.find((fact) => fact.name === 'Base attunement dwell').detail,
      patchId === 'current' ? '6s' : '9s'
    );
    assert.equal(
      facts(balance, ID.OVERLOAD_FIRE)['Base time in attunement before overload'],
      patchId === 'current' ? '6s' : '9s'
    );
    const trait = balance.catalog.balanceProfilesById.get(TRAIT.TRANSCENDENT_TEMPEST);
    assert.equal(trait.effects.find((effect) => effect.name === 'Transcendent Tempest').duration, 7);
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
