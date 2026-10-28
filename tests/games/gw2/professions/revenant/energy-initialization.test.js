import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVENANT_MAXIMUM_ENERGY,
  REVENANT_PRECOMBAT_ENERGY_CEILING,
  revenantStartingEnergy
} from '#gw2/professions/revenant/core/resource-values.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { constructedAndInitializedPool } from '#tests/helpers/resource-initialization.js';
import { REVENANT_TEST_CONFIG } from '#tests/helpers/revenant-simulation.js';

// Standalone construction and runtime initialization share one energy authority before combat begins.
test('constructed and initialized energy agree on fixed base recovery', () => {
  const aboveCeiling = (REVENANT_PRECOMBAT_ENERGY_CEILING + REVENANT_MAXIMUM_ENERGY) / 2;

  for (const [initialEnergy, value] of [
    [undefined, REVENANT_PRECOMBAT_ENERGY_CEILING],
    // The precombat ceiling stops recovery only; it never trims a larger starting balance.
    [aboveCeiling, aboveCeiling]
  ]) {
    const config = { ...REVENANT_TEST_CONFIG, specialization: 'Core', initialEnergy };
    const { constructed, initialized } = constructedAndInitializedPool(revenantProfession, config, 'energy');
    const expected = {
      value,
      maximum: REVENANT_MAXIMUM_ENERGY,
      rate: 5,
      recoveryMaximum: REVENANT_PRECOMBAT_ENERGY_CEILING
    };
    assert.deepEqual(constructed, expected, String(initialEnergy));
    assert.deepEqual(initialized, expected, String(initialEnergy));
  }
});

// Explicit values survive within capacity; only absent or NaN inputs take the default.
test('starting energy normalizes omitted, explicit, and out-of-range values', () => {
  for (const [initialEnergy, expected] of [
    [undefined, REVENANT_PRECOMBAT_ENERGY_CEILING],
    [null, REVENANT_PRECOMBAT_ENERGY_CEILING],
    [Number.NaN, REVENANT_PRECOMBAT_ENERGY_CEILING],
    [0, 0],
    [2.5, 2.5],
    [REVENANT_MAXIMUM_ENERGY + 1, REVENANT_MAXIMUM_ENERGY],
    [-3, 0],
    [Infinity, REVENANT_MAXIMUM_ENERGY],
    [-Infinity, 0]
  ])
    assert.equal(revenantStartingEnergy({ initialEnergy }), expected, String(initialEnergy));
});
