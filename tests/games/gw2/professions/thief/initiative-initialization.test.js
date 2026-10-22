import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefStartingInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog, thiefProfession } from '#gw2/professions/thief/profession.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { constructedAndInitializedPool } from '#tests/helpers/resource-initialization.js';
import { THIEF_TEST_CONFIG } from '#tests/helpers/thief-simulation.js';

// Distinct patched values prove both paths read the selected profiles rather than a copied default.
const BASE_CAPACITY = 14;
const BASE_REGENERATION = 3;
const PREPAREDNESS_CAPACITY = 17;
const patched = (catalog) =>
  withProfile(
    withProfile(catalog, PROFILE.resources, { maximumStacks: BASE_CAPACITY, resourceGain: BASE_REGENERATION }),
    TRAIT.PREPAREDNESS,
    { maximumStacks: PREPAREDNESS_CAPACITY }
  );

// Standalone construction and runtime initialization share one starting-initiative authority.
test('constructed and initialized initiative agree on the selected profiles', () => {
  for (const [selectedTraitIds, maximum] of [
    [[], BASE_CAPACITY],
    [[TRAIT.PREPAREDNESS], PREPAREDNESS_CAPACITY]
  ]) {
    const config = { ...THIEF_TEST_CONFIG, specialization: 'Core', selectedTraitIds };
    const { constructed, initialized } = constructedAndInitializedPool(thiefProfession, config, 'initiative', patched);
    // Preparedness raises the capacity only; an omitted start still begins at the selected base capacity.
    const expected = { value: BASE_CAPACITY, maximum, rate: BASE_REGENERATION, recoveryMaximum: undefined };
    assert.deepEqual(constructed, expected, String(selectedTraitIds));
    assert.deepEqual(initialized, expected, String(selectedTraitIds));
  }
});

// Explicit values survive within capacity; only absent or NaN inputs take the default.
test('starting initiative normalizes omitted, explicit, and out-of-range values', () => {
  const context = { catalog: patched(thiefCatalog) };

  for (const [initialInitiative, expected] of [
    [undefined, BASE_CAPACITY],
    [null, BASE_CAPACITY],
    [Number.NaN, BASE_CAPACITY],
    [0, 0],
    [2.5, 2.5],
    [PREPAREDNESS_CAPACITY + 1, PREPAREDNESS_CAPACITY],
    [-3, 0],
    [Infinity, PREPAREDNESS_CAPACITY],
    [-Infinity, 0]
  ])
    assert.equal(
      thiefStartingInitiative({ initialInitiative }, context, PREPAREDNESS_CAPACITY),
      expected,
      String(initialInitiative)
    );
});
