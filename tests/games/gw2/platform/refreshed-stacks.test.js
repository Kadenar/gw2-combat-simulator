import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

// Equivalent floating-point times must not change whether refresh carries the previous stacks forward.
for (const expiry of ['inclusive', 'exclusive']) {
  test(`refresh-all stacks use canonical ${expiry} boundaries`, () => {
    const prior = Object.freeze({ stacks: 2, expiresAt: 0.56 + 0.04 });
    assert.equal(activeRefreshedStacks(prior, 0.599999, expiry), 2);
    assert.equal(activeRefreshedStacks(prior, 0.6, expiry), expiry === 'inclusive' ? 2 : 0);
    assert.equal(activeRefreshedStacks(prior, 0.600001, expiry), 0);
    assert.equal(
      activeRefreshedStacks({ stacks: 2, expiresAt: 0.1 }, 0.3 - 0.2, expiry),
      expiry === 'inclusive' ? 2 : 0
    );
    assert.deepEqual(grantRefreshedStacks(prior, 1, 0.6, 0.137 + 5, 3, expiry), {
      stacks: expiry === 'inclusive' ? 3 : 1,
      expiresAt: 5.137
    });
    const unbounded = grantRefreshedStacks(prior, 1, 1, Infinity, 3, expiry);
    assert.deepEqual(unbounded, { stacks: 1, expiresAt: Infinity });
    assert.equal(activeRefreshedStacks(unbounded, 100, expiry), 1);
  });
}

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
