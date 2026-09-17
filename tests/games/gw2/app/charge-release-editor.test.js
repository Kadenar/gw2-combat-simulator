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
