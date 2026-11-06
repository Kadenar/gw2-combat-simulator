import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  attributeBonusNumber,
  balanceProfile,
  balanceProfileNumber,
  ownerAttributeBonusNumber,
  requireBalanceProfile
} from '#gw2/platform/skills/balance-profiles.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

// Optional discovery and required reads share the caller's selected profile map.
test('balance-profile lookup retains owner identity and treats an absent ID explicitly', () => {
  const profile = { id: 101, name: 'Selected profile' };
  const source = { balanceProfilesById: new Map([[101, profile]]) };
  assert.equal(balanceProfile(source, 101), profile);
  assert.equal(balanceProfile(source, 102), undefined);
  assert.throws(() => requireBalanceProfile(source, 102), /profile=102.*missing required profile/);
});

test('balance-profile numeric lookup returns patched values and rejects invalid fields', () => {
  const profile = { id: 101, name: 'Patchable', threshold: 3, effects: [] };
  const catalog = createCanonicalCatalog({ balanceProfiles: [profile] });
  const patched = applyBalanceProfilePatch(catalog, {
    balanceProfiles: { 101: { fields: { threshold: 7 } } }
  });
  const resolved = requireBalanceProfile(patched, 101);

  assert.equal(balanceProfileNumber(resolved, 'threshold'), 7);
  assert.throws(() => balanceProfileNumber(resolved, 'missing'), /profile=101 field=missing/);
  assert.throws(() => requireBalanceProfile(patched, 102), /profile=102/);
});

// Profile reads use the selected patch; owner reads also support skill-owned grants without a second lookup.
test('attribute bonus readers preserve selected values, zero grants, and required-field diagnostics', () => {
  const profile = {
    id: 101,
    name: 'Attribute fixture',
    attributeBonuses: { power: 120 },
    conditionalAttributeBonuses: { power: 60 }
  };
  const catalog = createCanonicalCatalog({ balanceProfiles: [profile] });
  const patched = applyBalanceProfilePatch(catalog, {
    balanceProfiles: { 101: { fields: { 'attributeBonuses.power': 0 } } }
  });
  assert.equal(attributeBonusNumber(catalog, 101, 'power'), 120);
  assert.equal(attributeBonusNumber(patched, 101, 'power'), 0);
  assert.equal(attributeBonusNumber(patched, 101, 'power', 'conditionalAttributeBonuses'), 60);
  assert.equal(ownerAttributeBonusNumber(requireBalanceProfile(patched, 101), 'power'), 0);
  assert.equal(ownerAttributeBonusNumber({ id: 102, attributeBonuses: { expertise: 180 } }, 'expertise'), 180);
  assert.throws(() => attributeBonusNumber(patched, 999, 'power'), /profile=999.*missing required profile/);
  assert.throws(() => attributeBonusNumber(patched, 101, 'expertise'), /owner=101 field=attributeBonuses.expertise/);
});
