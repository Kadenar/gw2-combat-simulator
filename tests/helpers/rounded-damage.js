import assert from 'node:assert/strict';

// Two independently rounded packets can differ from their exact modifier ratio by at most half a point each.
export function assertRoundedDamageMultiplier(actual, baseline, multiplier) {
  const error = (1 + Math.abs(multiplier)) / 2;
  assert.ok(
    Math.abs(actual - baseline * multiplier) <= error + 1e-9,
    `${actual} != ${baseline} × ${multiplier} within ${error}`
  );
}

// Flooring loses less than one point per packet; propagate that bound through a compared damage multiplier.
export function assertFlooredDamageMultiplier(actual, baseline, multiplier, packets = 1) {
  const difference = actual - baseline * multiplier;
  assert.ok(
    difference > -packets - 1e-9 && difference < packets * multiplier + 1e-9,
    `${actual} != ${baseline} × ${multiplier} within ${packets} floored packet(s)`
  );
}
