import assert from 'node:assert/strict';
import test from 'node:test';

import { splitConditionStacks } from '#gw2/platform/simulation/procedural-emission.js';

// Explicit splitting preserves application identity and timing without mutating the original packet.
test('condition splitting preserves fractional totals and packet fields and emits nothing for zero stacks', () => {
  const packet = Object.freeze({
    stacks: 2.5,
    condition: 'Burning',
    at: 3,
    duration: 7,
    sourceId: 'fixture',
    activationId: 'cast',
    actorType: 'player',
    metadata: { fixedDuration: true }
  });
  const applications = splitConditionStacks(packet);
  assert.deepEqual(
    applications,
    [1, 1, 0.5].map((stacks) => ({ ...packet, stacks }))
  );
  assert.deepEqual(splitConditionStacks({ ...packet, stacks: 0 }), []);
  assert.equal(packet.stacks, 2.5);
});
