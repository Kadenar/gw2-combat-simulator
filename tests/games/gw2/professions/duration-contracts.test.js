import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { activeChargeGrants } from '#gw2/platform/combat/resources/charges.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { balanceProfilePatchableNumericFields } from '#gw2/integrations/patches/authoring/fields.js';
import { authoringNumericFieldLabel } from '#gw2/integrations/patches/app/model.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { VENOMS, activateVenom } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { prepareTrap, thiefTrapAvailability } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/core/profile-ids.js';

// Profile lifetime controls charge entitlement, independently of the duration on each triggered condition.
test('patched venom duration owns personal and allied charge expiry and tooltip facts', () => {
  for (const venom of VENOMS) {
    const catalog = applyBalanceProfilePatch(thiefCatalog, {
      balanceProfiles: { [venom.profileId]: { fields: { duration: 2 } } }
    });
    const recipients = [];
    const runtime = {
      helpers: catalog,
      time: 10,
      profession: { core: { venomChargeBatches: {} } },
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
    assert.deepEqual(
      recipients.map(({ expiresAt }) => expiresAt),
      [12, 13]
    );
    assert.ok(recipients.every(({ inclusiveExpiry }) => inclusiveExpiry));
    assert.equal(activeChargeGrants(batches, 11.999).length, 2);
    assert.equal(activeChargeGrants(batches, 12).length, 1);
    assert.equal(activeChargeGrants(batches, 13).length, 0);
    const context = { catalog };
    const { facts } = describeSimulationSkill(context, skill, thiefTooltips);
    assert.equal(facts.find(({ name }) => name === 'Charge lifetime').detail, '2s');
    assert.deepEqual(
      catalog.balanceProfilesById.get(venom.profileId).effects,
      thiefCatalog.balanceProfilesById.get(venom.profileId).effects
    );
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
  for (const [catalog, id, field] of [
    [thiefCatalog, PROFILE.spiderVenomProc, 'duration'],
    [elementalistCatalog, ELEMENTALIST.rockBarrier, 'flipDuration']
  ]) {
    const profile = catalog.balanceProfilesById.get(id);
    assert.equal(balanceProfilePatchableNumericFields(profile)[field], profile[field]);
    assert.equal(balanceProfilePatchableNumericFields(profile).durationMultiplier, undefined);
    const patched = applyBalanceProfilePatch(catalog, { balanceProfiles: { [id]: { fields: { [field]: 7 } } } });
    assert.equal(patched.balanceProfilesById.get(id)[field], 7);
    assert.throws(
      () =>
        applyBalanceProfilePatch(catalog, {
          balanceProfiles: { [id]: { fields: { [field]: 7, durationMultiplier: 7 } } }
        }),
      /does not expose durationMultiplier/
    );
  }

  assert.throws(
    () => applySkillPatch(thiefCatalog, { skills: { [ID.PREPARE_PITFALL]: { fields: { durationMultiplier: 7 } } } }),
    /does not expose durationMultiplier/
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
  for (const field of ['duration', 'baseDuration', 'durationPerTier', 'durationExtension', 'flipDuration']) {
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
});
