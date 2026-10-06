import assert from 'node:assert/strict';
import test from 'node:test';
import { createProcRegistry, tryConsumeProcCooldown } from '#gw2/platform/combat/procs/registry.js';

// Exercise ordinary proc claims independently of profession effects and critical progress.
test('proc cooldown claims preserve canonical boundaries and isolate keys and owners', () => {
  const state = {};
  assert.equal(tryConsumeProcCooldown(state, 'trait', 0, 1), true);
  assert.deepEqual(state, { trait: 1 });
  for (const at of [0, 0.999999, 1, 1.0000004]) {
    assert.equal(tryConsumeProcCooldown(state, 'trait', at, 1), false);
    assert.deepEqual(state, { trait: 1 });
  }

  assert.equal(tryConsumeProcCooldown(state, 'trait', 1.000001, 1), true);
  assert.equal(state.trait, 2.000001);
  assert.equal(tryConsumeProcCooldown(state, 42, 0, 1), true);
  const otherOwner = {};
  assert.equal(tryConsumeProcCooldown(otherOwner, 'trait', 0, 1), true);
  assert.deepEqual(otherOwner, { trait: 1 });
});

test('proc cooldown validation rejects invalid claims without mutating state', () => {
  for (const readyAt of [NaN, 'invalid', Number.MAX_VALUE]) {
    const state = { trait: readyAt };
    assert.throws(() => tryConsumeProcCooldown(state, 'trait', 0, 1));
    assert.deepEqual(state, { trait: readyAt });
  }

  for (const [at, duration] of [
    [0, NaN],
    [0, Infinity],
    [0, -1],
    [0, Number.MAX_VALUE],
    [NaN, 1],
    [Infinity, 1]
  ]) {
    const state = {};
    assert.throws(() => tryConsumeProcCooldown(state, 'trait', at, duration));
    assert.deepEqual(state, {});
  }

  const blocked = { trait: 2 };
  assert.equal(tryConsumeProcCooldown(blocked, 'trait', 1, NaN), false);
  assert.deepEqual(blocked, { trait: 2 });
});

test('proc cooldowns preserve infinite sentinels and zero-duration behavior', () => {
  const state = { blocked: Infinity, unarmed: -Infinity };
  assert.equal(tryConsumeProcCooldown(state, 'blocked', 10, 1), false);
  assert.equal(state.blocked, Infinity);
  assert.equal(tryConsumeProcCooldown(state, 'unarmed', 0, 1), true);
  assert.equal(state.unarmed, 1);
  assert.equal(tryConsumeProcCooldown(state, 'zero', 0, 0), true);
  assert.equal(tryConsumeProcCooldown(state, 'zero', 0, 0), true);
  assert.equal(tryConsumeProcCooldown(state, 'zero', 1, 0), true);
  assert.equal(tryConsumeProcCooldown(state, 'zero', 1, 0), false);
  assert.equal(tryConsumeProcCooldown(state, 'zero', 1.000001, 0), true);
});

// Resolver callers supply event time explicitly; scoped claims retain independent recipient deadlines.
test('resolver proc registries read live profiles and isolate scopes and resets', () => {
  const profile = { id: 'trait', internalCooldown: 2 };
  const context = { helpers: { balanceProfilesById: new Map([['trait', profile]]) } };
  const procs = createProcRegistry(() => context);
  assert.throws(() => procs.claim('trait'), /event time/);
  assert.equal(procs.claim('trait', 'ally:1', 1), true);
  assert.equal(procs.claim('trait', 'ally:2', 1), true);
  assert.equal(procs.claim('trait', 'ally:1', 3), false);
  profile.internalCooldown = 4;
  assert.equal(procs.claim('trait', 'ally:1', 3.000001), true);
  assert.equal(procs.deadline('ally:1'), 7.000001);
  procs.reset('ally:1');
  assert.equal(procs.deadline('ally:1'), 0);
  assert.equal(procs.deadline('ally:2'), 3);
  assert.equal(createProcRegistry(() => context).deadline('ally:2'), 0);
});
