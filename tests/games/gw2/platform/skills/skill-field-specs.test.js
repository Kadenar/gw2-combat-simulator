import assert from 'node:assert/strict';
import test from 'node:test';

import { authoringNumericFieldLabel } from '#gw2/integrations/patches/app/model.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import {
  combineFields,
  dataField,
  defineFields,
  numberField,
  validateFieldValues
} from '#gw2/platform/skills/field-specs.js';
import { professionSkillFields, SHARED_SKILL_FIELDS } from '#gw2/platform/skills/shared-fields.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { WARRIOR_SKILL_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

// A field has one owner: two modules, or a module and the shared vocabulary, cannot both declare it.
test('skill field declarations reject duplicate owners and orphaned patch leaves', () => {
  const tuning = defineFields({ fixtureDelay: numberField({ unit: 'seconds', patch: 'primary' }) });
  assert.throws(
    () =>
      combineFields([
        { owner: 'Core', fields: tuning },
        { owner: 'Elite', fields: tuning }
      ]),
    /Duplicate field fixtureDelay in Core and Elite/
  );
  assert.throws(() => professionSkillFields({ cooldown: numberField() }), /Duplicate field cooldown/);
  assert.throws(
    () => professionSkillFields({ 'fixtureGroup.amount': numberField({ patch: 'primary' }) }),
    /requires its group fixtureGroup/
  );
  assert.ok(professionSkillFields({ fixtureGroup: dataField, 'fixtureGroup.amount': numberField() }));
  for (const spec of [
    { kind: 'text' },
    numberField({ unit: 'minutes' }),
    numberField({ minimum: 2, maximum: 1 }),
    numberField({ patch: 'primary', runtimeOnly: true })
  ])
    assert.throws(() => defineFields({ fixtureField: spec }), /fixtureField/);
});

// Declared bounds apply to authored and patched values alike; explicit zero remains valid tuning.
test('declared numeric bounds validate authored and patched catalogs', () => {
  const skillFields = defineFields({ fixtureFraction: numberField({ maximum: 1, patch: 'primary' }) });
  const load = (value) =>
    createCanonicalCatalog({ skillFields, generated: [{ id: 1, name: 'Fixture', fixtureFraction: value }] });
  for (const value of [0, 0.5, 1]) assert.equal(load(value).skillsById.get(1).fixtureFraction, value);
  for (const value of [-0.1, 1.1, NaN, Infinity, '0.5'])
    assert.throws(() => load(value), /field=fixtureFraction expected=finite number in \[0, 1\]/);

  const catalog = load(0.5);
  assert.equal(
    applySkillPatch(catalog, { skills: { 1: { fields: { fixtureFraction: 0 } } } }).skillsById.get(1).fixtureFraction,
    0
  );
  assert.throws(
    () => applySkillPatch(catalog, { skills: { 1: { fields: { fixtureFraction: 2 } } } }),
    /fixtureFraction/
  );
});

// Compiled rules must read each skill's current own values and retain the bounds of their specific registry.
test('numeric validation keeps grouped values and registry bounds independent', () => {
  const fields = defineFields({
    fixtureGroup: dataField,
    'fixtureGroup.amount': numberField({ maximum: 1 })
  });
  const otherFields = defineFields({
    fixtureGroup: dataField,
    'fixtureGroup.amount': numberField({ maximum: 3 })
  });
  for (const skill of [
    {},
    { fixtureGroup: {} },
    { fixtureGroup: [] },
    { fixtureGroup: Object.create({ amount: -1 }) },
    Object.create({ fixtureGroup: { amount: -1 } }),
    { fixtureGroup: { amount: 0 } },
    { fixtureGroup: { amount: 1 } }
  ])
    assert.doesNotThrow(() => validateFieldValues(skill, fields, 'Fixture'));

  const skill = { fixtureGroup: { amount: 2 } };
  assert.doesNotThrow(() => validateFieldValues(skill, otherFields, 'Fixture'));
  assert.throws(() => validateFieldValues(skill, fields, 'Fixture'), /field=fixtureGroup.amount/);
  skill.fixtureGroup.amount = 0.5;
  assert.doesNotThrow(() => validateFieldValues(skill, fields, 'Fixture'));
  for (const value of [null, '1', NaN, Infinity, -1])
    assert.throws(
      () => validateFieldValues({ fixtureGroup: { amount: value } }, fields, 'Fixture'),
      /field=fixtureGroup.amount/
    );
});

// Profession vocabulary is accepted only by the profession that declares it, in authored data and in patches.
test('profession-owned skill fields stay with their profession', () => {
  assert.equal(Object.hasOwn(SHARED_SKILL_FIELDS, 'detonationDelay'), false);
  assert.equal(Object.hasOwn(SHARED_SKILL_FIELDS, 'rechargeMultiplier'), false);
  assert.throws(
    () => createCanonicalCatalog({ generated: [{ id: 1, name: 'Undeclared', rechargeMultiplier: 0.5 }] }),
    /unsupported field: rechargeMultiplier/
  );
  assert.throws(
    () =>
      applySkillPatch(warriorProfession.catalog, {
        skills: { [WARRIOR.BLADETRAIL]: { fields: { detonationDelay: 1 } } }
      }),
    /unsupported patch field detonationDelay/
  );
  const patched = applySkillPatch(elementalistProfession.catalog, {
    skills: { [ELEMENTALIST.FROZEN_FUSILLADE]: { fields: { detonationDelay: 2 } } }
  });
  assert.equal(patched.skillsById.get(ELEMENTALIST.FROZEN_FUSILLADE).detonationDelay, 2);
});

// A runtime assembled from Core and one elite keeps the profession-wide table, because elite-authored shared
// skills can resolve to its Core fragment.
test('runtime catalogs retain every module declaration of their profession', () => {
  const tempest = elementalistProfession.runtimeFor({ specialization: 'Tempest' });
  assert.equal(tempest.catalog.skillFields.mightTierThreshold?.kind, 'number');
  assert.equal(tempest.catalog.skillFields.airBulletRechargeMultiplier?.kind, 'number');
});

// The editor labels a profession field from its own declaration, which only the selected profession supplies.
test('authoring metadata carries profession field labels and units', () => {
  const { skillFields } = withPatchPreview(elementalistProfession, null).patchAuthoring;
  assert.deepEqual(
    { label: skillFields.detonationDelay.label, unit: skillFields.detonationDelay.unit },
    { label: 'enhanced detonation delay', unit: 'seconds' }
  );
  assert.equal(skillFields.cooldown.unit, 'seconds');
  assert.equal(skillFields.overload, undefined);
  assert.equal(
    authoringNumericFieldLabel('detonationDelay', skillFields.detonationDelay),
    'enhanced detonation delay (s)'
  );
  assert.equal(authoringNumericFieldLabel('cooldown'), 'cooldown (s)');
});
