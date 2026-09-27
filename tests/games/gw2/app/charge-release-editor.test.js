import assert from 'node:assert/strict';
import test from 'node:test';
import { chargeReleaseRowLabel } from '#gw2/app/rotation/editing/charge-release-editor.js';

// The Bladesworn Dragon Slash release editor labels each projected charge outcome.
test('charge release rows expose time, Flow, and coefficient', () => {
  assert.equal(
    chargeReleaseRowLabel({
      charges: 3,
      at: 12.75,
      delta: 0.75,
      flowAfter: 7.5,
      coefficient: 5.435
    }),
    '3 charges · 12.750s (+0.750s) · 7.50 Flow · 5.43 coefficient'
  );
});

// Release times share the timeline's combat-relative clock, so precombat setup does not inflate them.
test('charge release row times are relative to the combat-start marker', () => {
  assert.equal(
    chargeReleaseRowLabel({ charges: 10, at: 27.24, delta: 2.48, flowAfter: 44.72, coefficient: 20.4 }, 3960),
    '10 charges · 23.280s (+2.480s) · 44.72 Flow · 20.40 coefficient'
  );
});

// Rejected candidates expose availability without presenting placeholder simulation values.
test('unreachable charge release rows show no invented time or Flow', () => {
  assert.equal(
    chargeReleaseRowLabel({ charges: 5, at: 0, delta: 0, flowAfter: null, coefficient: 0, disabled: true }),
    '5 charges · unavailable'
  );
});
