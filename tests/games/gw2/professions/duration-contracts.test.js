import assert from 'node:assert/strict';
import test from 'node:test';

import { skillPatchableNumericFields } from '#gw2/integrations/patches/authoring/fields.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { prepareTrap, thiefTrapAvailability } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { activateVenom, VENOMS } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { activeBatches } from '#kernel/resources/batch-list.js';

// The skill's grant buff controls charge entitlement independently of its action's triggered condition duration.
test('patched venom duration owns personal and allied charge expiry', () => {
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
    assert.equal(recipients.at(-1).isActive(13.000001), false);
    // The ally's native batches share the player's lifetime and exclusive expiry.
    const allied = runtime.profession.core.alliedVenomChargeBatches[`1:${skill.id}`];
    for (const owned of [batches, allied]) {
      assert.equal(activeBatches(owned, 11.999, { order: 'earliest-expiry' }).length, 2);
      assert.equal(activeBatches(owned, 12.000001, { order: 'earliest-expiry' }).length, 1);
      assert.equal(activeBatches(owned, 13.000001, { order: 'earliest-expiry' }).length, 0);
    }
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
        // Availability resolves the trigger from the same patched catalog as its placement.
        helpers: catalog,
        time: 10,
        flips: {},
        armFlip(id, { availableAt, expiresAt = Infinity, visibleAt = availableAt }) {
          return armSkillFlip(this.flips, id, availableAt, expiresAt, visibleAt);
        },
        cooldownController: { rate: () => rate }
      };
      prepareTrap(runtime, { skill });
      const child = catalog.skillsById.get(trigger);
      const availability = thiefTrapAvailability(runtime, child);
      assert.equal(availability.ready, false);
      assert.equal(availability.retryAt, 10 + 5 / rate);
      runtime.time = availability.retryAt;
      assert.equal(thiefTrapAvailability(runtime, child), null);
      assert.equal(runtime.flips[trigger].expiresAt, null);
      assert.equal(thiefTrapAvailability(runtime, skill).retryAt, null);
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
  const factors = createCanonicalCatalog({
    balanceProfiles: [{ id: 1, name: 'Factor', durationMultiplier: 1.5 }]
  });
  assert.equal(
    applyBalanceProfilePatch(factors, {
      balanceProfiles: { 1: { fields: { durationMultiplier: 2 } } }
    }).balanceProfilesById.get(1).durationMultiplier,
    2
  );
});

// Both catalog construction and patch application reject malformed seconds before they enter runtime math.
test('duration fields require finite positive seconds in catalogs and patches', () => {
  for (const field of ['duration', 'baseDuration', 'durationPerTier', 'durationExtension']) {
    const profile = { id: 1, name: 'Duration', [field]: 2 };
    const catalog = createCanonicalCatalog({ balanceProfiles: [profile] });
    for (const value of [0, -1, NaN, Infinity, '3', null]) {
      assert.throws(
        () => createCanonicalCatalog({ balanceProfiles: [{ ...profile, [field]: value }] }),
        /expected=finite number/
      );
      assert.throws(() =>
        applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { fields: { [field]: value } } } })
      );
    }

    assert.equal(
      applyBalanceProfilePatch(catalog, {
        balanceProfiles: { 1: { fields: { [field]: 0.5 } } }
      }).balanceProfilesById.get(1)[field],
      0.5
    );
  }

  // Skill-owned lifetimes use the same admission rule as profile durations.
  for (const field of ['duration', 'flipDuration']) {
    const skill = { id: 1, name: 'Duration', [field]: 2 };
    const catalog = createCanonicalCatalog({ skills: [skill] });
    for (const value of [0, -1, NaN, Infinity, '3', null]) {
      assert.throws(() => createCanonicalCatalog({ skills: [{ ...skill, [field]: value }] }));
      assert.throws(() => applySkillPatch(catalog, { skills: { 1: { fields: { [field]: value } } } }));
    }

    assert.equal(
      applySkillPatch(catalog, { skills: { 1: { fields: { [field]: 0.5 } } } }).skillsById.get(1)[field],
      0.5
    );
  }

  assert.throws(
    () =>
      applySkillPatch(elementalistCatalog, {
        skills: { [ELEMENTALIST.SHATTERING_STONE]: { fields: { duration: 0 } } }
      }),
    /field=duration/
  );
});
