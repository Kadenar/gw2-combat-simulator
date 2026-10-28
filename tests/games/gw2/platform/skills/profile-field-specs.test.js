import assert from 'node:assert/strict';
import test from 'node:test';

import { authoringNumericFieldLabel } from '#gw2/integrations/patches/app/model.js';
import {
  balanceProfileAuthoringReference,
  balanceProfileNumericFieldTier
} from '#gw2/integrations/patches/authoring/fields.js';
import { generatePatchOverview } from '#gw2/integrations/patches/authoring/overview-generation.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { attributeBonusNumber, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineFields, numberField, patchableNumericFields } from '#gw2/platform/skills/field-specs.js';
import { professionProfileFields, SHARED_PROFILE_FIELDS } from '#gw2/platform/skills/profile-fields.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

// Profiles enforce the selected registry on both authored values and overlays, without accepting retired targets.
test('profile declarations enforce ownership, numeric bounds, and grouped attributes', () => {
  assert.throws(() => professionProfileFields({ cooldown: numberField() }), /Duplicate field cooldown/);
  assert.throws(() => professionProfileFields({ 'missing.amount': numberField() }), /requires its group missing/);
  const profileFields = defineFields({ chance: numberField({ maximum: 1, patch: 'primary' }) });
  const load = (fields = {}) =>
    createCanonicalCatalog({
      profileFields,
      balanceProfiles: [{ id: 1, name: 'Fixture', chance: 0.5, attributeBonuses: { power: 10 }, ...fields }]
    });
  for (const value of [-1, 2, Infinity, NaN, '0.5'])
    assert.throws(() => load({ chance: value }), /field=chance expected=finite number/);
  for (const attributeBonuses of [null, [], { misspelled: 1 }, { power: -1 }])
    assert.throws(() => load({ attributeBonuses }), /attributeBonuses/);
  assert.throws(() => load({ expertiseBonus: 10 }), /unsupported field: expertiseBonus/);
  assert.throws(
    () => createCanonicalCatalog({ balanceProfiles: [{ id: 1, name: 'Wrong owner', chance: 0.5 }] }),
    /unsupported field: chance/
  );
  const catalog = load();
  const patch = (fields) => applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { fields } } });
  assert.equal(patch({ chance: 0 }).balanceProfiles[0].chance, 0);
  assert.throws(() => patch({ chance: 2 }), /field=chance/);
  for (const field of ['expertiseBonus', 'concentrationBonus', 'boonStacks', 'boonDuration'])
    assert.throws(() => patch({ [field]: 1 }), /unsupported patch field/);
  const patched = patch({ 'attributeBonuses.power': 20 }).balanceProfiles[0];
  assert.equal(patched.attributeBonuses.power, 20);
  assert.equal(catalog.balanceProfiles[0].attributeBonuses.power, 10);
  assert.deepEqual(balanceProfileAuthoringReference(patched, catalog.profileFields).attributeBonuses, { power: 20 });
});

// One descriptor controls editor units and tiers, while static declarations specialize generic attribute labels.
test('profile authoring derives units, tiers, and attribute labels from declarations', () => {
  for (const [field, label] of [
    ['duration', 'duration (s)'],
    ['procChance', 'proc chance (0-1)'],
    ['attributeConversion', 'attribute conversion (fraction)'],
    ['damageMultiplier', 'damage multiplier (factor)'],
    ['attributeBonuses.power', 'Power bonus (points)']
  ])
    assert.equal(authoringNumericFieldLabel(field, SHARED_PROFILE_FIELDS[field]), label);
  assert.equal(balanceProfileNumericFieldTier('pulseInterval', SHARED_PROFILE_FIELDS), 'advanced');
  assert.equal(balanceProfileNumericFieldTier('duration', SHARED_PROFILE_FIELDS), 'primary');
  assert.equal(balanceProfileNumericFieldTier('expertiseBonus', SHARED_PROFILE_FIELDS), null);
  const metadata = withPatchPreview(engineerProfession, null).patchAuthoring;
  const entry = metadata.modules
    .flatMap((module) => module.balanceProfiles)
    .find(({ id }) => id === ENGINEER_TRAIT_IDS.COMPOUNDING_CHEMICALS);
  assert.equal(
    authoringNumericFieldLabel('attributeBonuses.concentration', entry.fieldSpecs['attributeBonuses.concentration']),
    'Concentration bonus (points)'
  );
  const notes = generatePatchOverview(
    { balanceProfiles: { [entry.id]: { fields: { 'attributeBonuses.concentration': { add: 10 } } } } },
    metadata
  );
  assert.match(notes[0].text, /Concentration bonus \+10/);
});

// Every real numeric profile field is declared; editable declarations must have an owner in the assembled catalogs.
test('profession catalogs expose only declared profile vocabulary and retain it in runtime catalogs', async () => {
  const usedShared = new Set();
  for (const id of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const { [`${id}Profession`]: profession } = await import(`#gw2/professions/${id}/profession.js`);
    const catalog = profession.catalog;
    const used = new Set(catalog.balanceProfiles.flatMap((profile) => Object.keys(profile)));
    for (const [field] of patchableNumericFields(catalog.profileFields)) {
      if (field.includes('.')) continue;

      if (used.has(field)) usedShared.add(field);

      if (!Object.hasOwn(SHARED_PROFILE_FIELDS, field)) assert.ok(used.has(field), `${id}: unused ${field}`);
    }

    const runtime = profession.resolveProfession({});
    assert.deepEqual(runtime.catalog.profileFields, catalog.profileFields);
  }

  for (const [field] of patchableNumericFields(SHARED_PROFILE_FIELDS))
    if (!field.includes('.')) assert.ok(usedShared.has(field), `unused shared field ${field}`);
});

// Independently tuned attributes and conditional groups must preserve sibling grants and explicit zero.
test('named profile grants validate and patch independently across grant groups', () => {
  const make = (conditionalAttributeBonuses = { power: 30 }) =>
    createCanonicalCatalog({
      balanceProfiles: [
        { id: 1, name: 'Grant owner', attributeBonuses: { power: 10, precision: 20 }, conditionalAttributeBonuses }
      ]
    });
  for (const invalid of [null, [], { typo: 1 }, { power: -1 }, { power: NaN }])
    assert.throws(() => make(invalid), /conditionalAttributeBonuses/);
  const base = make();
  const patched = applyBalanceProfilePatch(base, {
    balanceProfiles: {
      1: {
        fields: {
          'attributeBonuses.power': 0,
          'conditionalAttributeBonuses.power': 40
        }
      }
    }
  });
  const owner = patched.balanceProfilesById.get(1);
  assert.equal(attributeBonusNumber(owner, 'power'), 0);
  assert.equal(attributeBonusNumber(owner, 'precision'), 20);
  assert.equal(attributeBonusNumber(owner, 'power', 'conditionalAttributeBonuses'), 40);
  assert.equal(attributeBonusNumber(base.balanceProfilesById.get(1), 'power'), 10);
  assert.throws(() => attributeBonusNumber(owner, 'expertise'), /field=attributeBonuses.expertise/);
  for (const field of ['attributeBonus', 'weaponAttributeBonus'])
    assert.throws(
      () => applyBalanceProfilePatch(base, { balanceProfiles: { 1: { fields: { [field]: 10 } } } }),
      /unsupported patch field/
    );
  // Scalar readers do not interpret authoring paths; named grant readers receive the group and key separately.
  assert.throws(() => balanceProfileNumber(owner, 'attributeBonuses.power'), /expected=finite number/);
});
