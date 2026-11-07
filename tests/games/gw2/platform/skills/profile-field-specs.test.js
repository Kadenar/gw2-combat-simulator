import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';
import { professionProfileFields } from '#gw2/platform/skills/profile-fields.js';

// Catalogs enforce declared field ownership and numeric bounds before patch authoring.
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
});

// Conditional grant groups reject malformed values independently of ordinary attribute grants.
test('conditional profile grants validate their attribute names and numeric values', () => {
  const make = (conditionalAttributeBonuses = { power: 30 }) =>
    createCanonicalCatalog({
      balanceProfiles: [
        { id: 1, name: 'Grant owner', attributeBonuses: { power: 10, precision: 20 }, conditionalAttributeBonuses }
      ]
    });
  for (const invalid of [null, [], { typo: 1 }, { power: -1 }, { power: NaN }])
    assert.throws(() => make(invalid), /conditionalAttributeBonuses/);
});
