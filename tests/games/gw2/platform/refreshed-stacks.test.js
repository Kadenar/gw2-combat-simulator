import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

// Boundary choice belongs to the mechanic; queries and grants leave the supplied observation untouched.
for (const expiry of ['inclusive', 'exclusive']) {
  test(`refresh-all stacks preserve ${expiry} expiry, cap refreshes, and absolute deadlines`, () => {
    const prior = Object.freeze({ stacks: 2, expiresAt: 5 });
    assert.equal(activeRefreshedStacks(prior, 4, expiry), 2);
    assert.equal(activeRefreshedStacks(prior, 5, expiry), expiry === 'inclusive' ? 2 : 0);
    assert.equal(activeRefreshedStacks(prior, 5.001, expiry), 0);
    assert.deepEqual(grantRefreshedStacks(prior, 1, 4, 9.001, 2, expiry), { stacks: 2, expiresAt: 9.001 });
    assert.deepEqual(grantRefreshedStacks(prior, 1, 5, 10, 3, expiry), {
      stacks: expiry === 'inclusive' ? 3 : 1,
      expiresAt: 10
    });
    assert.deepEqual(grantRefreshedStacks(prior, 1, 6, 11, 3, expiry), { stacks: 1, expiresAt: 11 });
    assert.deepEqual(grantRefreshedStacks(prior, 1, 6, 11, 0, expiry), { stacks: 0, expiresAt: 11 });
    assert.deepEqual(prior, { stacks: 2, expiresAt: 5 });
  });
}
