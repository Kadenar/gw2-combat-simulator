import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { activeChargeGrants } from '#gw2/platform/combat/resources/charges.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { skillPatchableNumericFields } from '#gw2/integrations/patches/authoring/fields.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { authoringNumericFieldLabel } from '#gw2/integrations/patches/app/model.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { VENOMS, activateVenom } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { prepareTrap, thiefTrapAvailability } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';

// The skill's grant buff controls charge entitlement independently of its action's triggered condition duration.
test('patched venom duration owns personal and allied charge expiry and tooltip facts', () => {
  for (const venom of VENOMS) {
    const source = thiefCatalog.skillsById.get(venom.skillId);
    const grant = source.effects.find((effect) => effect.type === 'buff');
    const catalog = applySkillPatch(thiefCatalog, {
      skills: { [venom.skillId]: { effects: [{ type: 'buff', name: grant.name, duration: 2 }] } }
    });
    const recipients = [];
    const runtime = {
      helpers: catalog,
      time: 10,
      profession: { core: { venomChargeBatches: {}, alliedVenomChargeBatches: {} } },
      alliedStrikes: { registerRecipients: (create) => recipients.push(create(1)) }
    };
    const skill = catalog.skillsById.get(venom.skillId);
    activateVenom(runtime, { id: 'first', skill });
    runtime.time = 11;
    activateVenom(runtime, { id: 'second', skill });
    const batches = runtime.profession.core.venomChargeBatches[skill.id];
    assert.deepEqual(
      batches.map(({ expiresAt }) => expiresAt),
      [12, 13]
    );
    // The ally's registration answers liveness from its native batches, through the later batch's expiry.
    assert.equal(recipients.at(-1).isActive(12.999), true);
    assert.equal(recipients.at(-1).isActive(13), false);
    // The ally's native batches share the player's lifetime and exclusive expiry.
    const allied = runtime.profession.core.alliedVenomChargeBatches[`1:${skill.id}`];
    for (const owned of [batches, allied]) {
      assert.equal(activeChargeGrants(owned, 11.999).length, 2);
      assert.equal(activeChargeGrants(owned, 12).length, 1);
      assert.equal(activeChargeGrants(owned, 13).length, 0);
    }

    const context = { catalog };
    const { facts } = describeSimulationSkill(context, skill, thiefTooltips);
    assert.match(
      facts.find(({ name }) => name.toLowerCase() === venom.skillName.toLowerCase()).detail,
      /^2s — charge grant/
    );
    assert.deepEqual(requireSkillAction(skill, 'venom').effects, requireSkillAction(source, 'venom').effects);
  }
});

// Arming duration determines the retry deadline; it does not expire the prepared trigger.
test('patched preparation duration governs recharge-scaled availability without a default', () => {
  for (const [placement, trigger] of [
    [ID.PREPARE_THOUSAND_NEEDLES, ID.THOUSAND_NEEDLES],
    [ID.PREPARE_PITFALL, ID.PITFALL]
  ]) {
    for (const rate of [1, 1.25]) {
      const catalog = applySkillPatch(thiefCatalog, { skills: { [placement]: { fields: { duration: 5 } } } });
      const skill = catalog.skillsById.get(placement);
      const runtime = {
        time: 10,
        profession: { core: { availableFlips: {} } },
        cooldownController: { rate: () => rate }
      };
      prepareTrap(runtime, { skill });
      const child = catalog.skillsById.get(trigger);
      const availability = thiefTrapAvailability(runtime, child);
      assert.equal(availability.ready, false);
      assert.equal(availability.retryAt, 10 + 5 / rate);
      runtime.time = availability.retryAt;
      assert.equal(thiefTrapAvailability(runtime, child), null);
      assert.equal(runtime.profession.core.availableFlips[trigger].expiresAt, null);
      assert.equal(thiefTrapAvailability(runtime, skill).retryAt, null);
      const context = { catalog };
      const { facts } = describeSimulationSkill(context, skill, thiefTooltips);
      assert.equal(facts.find(({ name }) => name === 'Base arming delay').detail, '5s');
      assert.throws(() => prepareTrap(runtime, { skill: { ...skill, duration: undefined } }), /field=duration/);
    }
  }
});

// Authoring must expose the canonical unit and reject retired spellings, even alongside a valid edit.
test('duration and flip patches reject obsolete names while real multipliers remain patchable', () => {
  for (const [catalog, id, field, collection, patchKey, patch, fields] of [
    [
      thiefCatalog,
      ID.PREPARE_PITFALL,
      'duration',
      'skillsById',
      'skills',
      applySkillPatch,
      (skill) => skillPatchableNumericFields(skill, thiefCatalog.skillFields)
    ],
    [
      elementalistCatalog,
      ELEMENTALIST.ROCK_BARRIER,
      'flipDuration',
      'skillsById',
      'skills',
      applySkillPatch,
      (skill) => skillPatchableNumericFields(skill, elementalistCatalog.skillFields)
    ]
  ]) {
    // Preparation and flip lifetimes both belong to their canonical skills.
    const owner = catalog[collection].get(id);
    assert.equal(fields(owner)[field], owner[field]);
    assert.equal(fields(owner).durationMultiplier, undefined);
    const patched = patch(catalog, { [patchKey]: { [id]: { fields: { [field]: 7 } } } });
    assert.equal(patched[collection].get(id)[field], 7);
    assert.throws(
      () =>
        patch(catalog, {
          [patchKey]: { [id]: { fields: { [field]: 7, durationMultiplier: 7 } } }
        }),
      /unsupported patch field durationMultiplier/
    );
  }

  assert.throws(
    () => applySkillPatch(thiefCatalog, { skills: { [ID.PREPARE_PITFALL]: { fields: { durationMultiplier: 7 } } } }),
    /unsupported patch field durationMultiplier/
  );
  assert.throws(
    () => createCanonicalCatalog({ generated: [{ id: 1, name: 'Retired', durationMultiplier: 3 }] }),
    /unsupported field: durationMultiplier/
  );
  const factors = createCanonicalCatalog({
    balanceProfiles: [{ id: 1, name: 'Factor', profileKind: 'trait', durationMultiplier: 1.5 }]
  });
  assert.equal(
    applyBalanceProfilePatch(factors, {
      balanceProfiles: { 1: { fields: { durationMultiplier: 2 } } }
    }).balanceProfilesById.get(1).durationMultiplier,
    2
  );
  assert.equal(authoringNumericFieldLabel('flipDuration'), 'flip duration (s)');
  assert.equal(authoringNumericFieldLabel('durationMultiplier'), 'duration multiplier');
});

// Both catalog construction and patch application reject malformed seconds before they enter runtime math.
test('duration fields validate finite nonnegative seconds and preserve explicit zero', () => {
  for (const field of ['duration', 'baseDuration', 'durationPerTier', 'durationExtension']) {
    const profile = { id: 1, name: 'Duration', profileKind: 'mechanic', [field]: 2 };
    const catalog = createCanonicalCatalog({ balanceProfiles: [profile] });
    for (const value of [-1, NaN, Infinity, '3', null]) {
      assert.throws(() => createCanonicalCatalog({ balanceProfiles: [{ ...profile, [field]: value }] }), /seconds/);
      assert.throws(() =>
        applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { fields: { [field]: value } } } })
      );
    }

    assert.equal(
      applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { fields: { [field]: 0 } } } }).balanceProfilesById.get(
        1
      )[field],
      0
    );
  }

  // Flip windows now belong to skills, so validate and patch them through the skill contract.
  const skill = { id: 1, name: 'Flip', flipDuration: 2 };
  const catalog = createCanonicalCatalog({ generated: [skill] });
  for (const value of [-1, NaN, Infinity, '3', null]) {
    assert.throws(() => createCanonicalCatalog({ generated: [{ ...skill, flipDuration: value }] }));
    assert.throws(() => applySkillPatch(catalog, { skills: { 1: { fields: { flipDuration: value } } } }));
  }

  assert.equal(
    applySkillPatch(catalog, { skills: { 1: { fields: { flipDuration: 0 } } } }).skillsById.get(1).flipDuration,
    0
  );
});
