import assert from 'node:assert/strict';
import test from 'node:test';

import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';

// GW2 procs require a later canonical instant, even when arithmetic differs at the boundary.
test('internal cooldowns remain active through their boundary timestamp', () => {
  assert.equal(isInternalCooldownReady(0, 0), true);
  assert.equal(isInternalCooldownReady(0.999, 1), false);
  assert.equal(isInternalCooldownReady(1, 1), false);
  assert.equal(isInternalCooldownReady(1.001, 1), true);
  assert.equal(isInternalCooldownReady(0.1 + 0.2, 0.3), false);
  assert.equal(isInternalCooldownReady(0.300001, 0.3), true);
});

// Unarmed and equipment sentinel deadlines must retain their meaning outside the kernel clock.
test('internal cooldowns preserve unarmed and infinite deadline semantics', () => {
  assert.equal(isInternalCooldownReady(0), true);
  assert.equal(isInternalCooldownReady(-0.000001, 0), false);
  assert.equal(isInternalCooldownReady(1, -Infinity), true);
  assert.equal(isInternalCooldownReady(1, Infinity), false);
});
