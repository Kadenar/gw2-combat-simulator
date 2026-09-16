import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import {
  loadReferenceEncounter,
  readReferenceResults
} from '../../fixtures/gw2combat-reference/reference-encounter.js';

// Preset regression policy: only total DPS against the recorded reference value, within 1%.
const MAXIMUM_RELATIVE_ERROR = 0.01;

function assertWithinReference(actual, expected, label) {
  const relative = Math.abs(actual - expected) / expected;
  assert.ok(relative <= MAXIMUM_RELATIVE_ERROR, `${label} DPS ${actual} differs from ${expected} by ${relative}`);
}

test('the frozen Willbender reference encounter simulates within 1% of the C++ reference mean', () => {
  const result = runCombatEngine({ encounter: loadReferenceEncounter(), output: 'score', seed: 1 });

  assert.equal(result.ok, true, result.message);
  assertWithinReference(result.dps, readReferenceResults().canonical.meanDps, 'canonical');
});

test('the deterministic reference variant simulates within 1% of the C++ reference', () => {
  const result = runCombatEngine({ encounter: loadReferenceEncounter({ deterministic: true }), output: 'score' });

  assert.equal(result.ok, true, result.message);
  assertWithinReference(result.dps, readReferenceResults().deterministic.dps, 'deterministic');
});
