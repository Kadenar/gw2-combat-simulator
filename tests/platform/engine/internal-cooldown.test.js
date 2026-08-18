import assert from 'node:assert/strict';
import test from 'node:test';

import { isInternalCooldownReady } from '../../../js/platform/engine/clock.js';

test('internal cooldowns remain active through their boundary timestamp', () => {
  assert.equal(isInternalCooldownReady(0, 0), true);
  assert.equal(isInternalCooldownReady(0.999, 1), false);
  assert.equal(isInternalCooldownReady(1, 1), false);
  assert.equal(isInternalCooldownReady(1.001, 1), true);
});
