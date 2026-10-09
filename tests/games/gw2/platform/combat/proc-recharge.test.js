import assert from 'node:assert/strict';
import test from 'node:test';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Exercise the shared clock with real recharge intervals, independently of profession trigger eligibility.
function fixture(rate = 1.25) {
  const profiles = new Map([
    [1, { id: 1, name: 'Fixed proc', profileKind: 'trait', internalCooldown: 10 }],
    [2, { id: 2, name: 'Player skill', profileKind: 'trait', cooldown: 10, cooldownPolicy: 'playerRecharge' }],
    [3, { id: 3, name: 'Summon skill', profileKind: 'trait', cooldown: 10, cooldownPolicy: 'summonRecharge' }]
  ]);
  const events = [];
  const timeline = createGw2TimelineIndex({ playerAlacrityRechargeRate: rate, events, resolved: true });
  const runtime = { time: 1, helpers: { balanceProfilesById: profiles }, query: { timeline } };
  return { procs: createProcRegistry(() => runtime), profiles, events };
}

for (const rate of [1, 1.25, 1.5]) {
  test(`profile policy selects fixed or player recharge at rate ${rate}`, () => {
    const { procs } = fixture(rate);
    assert.equal(procs.claim(1), true);
    assert.equal(procs.claim(2), true);
    assert.equal(procs.deadline(1), 11);
    const deadline = canonicalTime(1 + 10 / rate);
    assert.equal(procs.deadline(2), deadline);
    assert.equal(procs.claim(2, 2, 1), false);
    assert.equal(procs.claim(2, 2, deadline - 0.001), false);
    assert.equal(procs.claim(2, 2, deadline), false);
    assert.equal(procs.claim(2, 2, deadline + 0.001), true);
    assert.equal(procs.deadline(1), 11);
    const snapshot = procs.snapshot();
    snapshot[2] = 999;
    assert.notEqual(procs.deadline(2), 999);
  });
}

test('summon recharge integrates later grants and expiry for the captured companion only', () => {
  const { procs, events } = fixture(1.5);
  assert.throws(() => procs.claim(3), /companion identity/);
  assert.equal(procs.claim(3, 'first', 1, 'pet-a'), true);
  assert.equal(procs.claim(3, 'second', 1, 'pet-b'), true);
  assert.equal(procs.deadline('first'), 11);
  events.push({
    type: 'buff',
    at: 3,
    kind: 'alacrity',
    duration: 4,
    stacks: 1,
    resolvedAudience: {
      includesSelf: false,
      includesSummons: true,
      alliedPlayerCount: 0,
      recipientCount: 1,
      companionIds: ['pet-a']
    }
  });
  assert.equal(procs.deadline('first'), 10);
  assert.equal(procs.deadline('second'), 11);
  assert.equal(procs.claim(3, 'first', 10, 'pet-a'), false);
  assert.equal(procs.claim(3, 'first', 10.001, 'pet-a'), true);
  assert.equal(procs.deadline('first'), 20.001);
});

test('scoped recharges, reset, and explicit deadlines do not leak across proc owners', () => {
  const { procs } = fixture();
  assert.equal(procs.claim(2, 'fire', 1), true);
  assert.equal(procs.claim(2, 'water', 2), true);
  assert.equal(procs.deadline('fire'), 9);
  assert.equal(procs.deadline('water'), 10);
  procs.reset('fire');
  assert.equal(procs.deadline('fire'), 0);
  assert.equal(procs.claim(2, 'fire', 2), true);
  procs.setDeadline('fire', 50);
  assert.equal(procs.deadline('fire'), 50);
  assert.equal(procs.deadline('water'), 10);
  procs.claim(2, 2, 1);
  procs.reset('2');
  assert.equal(procs.deadline(2), 0);
});

test('recharge profiles reject invalid work and obsolete ICD fields', () => {
  const { procs, profiles } = fixture();
  const profile = profiles.get(2);
  for (const cooldown of [undefined, -1, NaN, Infinity]) {
    profiles.set(2, { ...profile, cooldown });
    assert.throws(() => procs.claim(2));
    assert.equal(procs.deadline(2), 0);
  }

  profiles.set(2, { ...profile, internalCooldown: 10 });
  assert.throws(() => procs.claim(2), /not internalCooldown/);
  profiles.set(2, { ...profile, cooldownPolicy: 'typo' });
  assert.throws(() => procs.claim(2), /Invalid proc cooldown policy/);
  profiles.set(2, { ...profile, cooldown: 0 });
  assert.equal(procs.claim(2), true);
  assert.equal(procs.deadline(2), 1);
  assert.equal(procs.claim(2), false);
  assert.equal(procs.claim(2, 2, 1.000001), true);
});
