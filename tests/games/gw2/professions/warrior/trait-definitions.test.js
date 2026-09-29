import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorNativeModules, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
// Profile-only and behavior-only traits both register once in their native module.
test('Warrior trait profiles have a single registered owner across Core and all elites', () => {
  const definitions = warriorNativeModules.flatMap((module) => module.traitDefinitions);
  assert.equal(new Set(definitions.map(({ id }) => id)).size, definitions.length);
  for (const profile of warriorProfession.catalog.balanceProfiles.filter(
    ({ profileKind }) => profileKind === 'trait'
  )) {
    assert.equal(
      definitions.filter(
        ({ id, balance, profiles }) =>
          (balance && (balance.id ?? id) === profile.id) || profiles?.some(({ id }) => id === profile.id)
      ).length,
      1,
      profile.name
    );
  }

  for (const id of [TRAIT.DUAL_WIELDING, TRAIT.VERSATILE_POWER, TRAIT.UNYIELDING_DRAGON]) {
    assert.equal(definitions.filter((trait) => trait.id === id).length, 1);
  }
});
