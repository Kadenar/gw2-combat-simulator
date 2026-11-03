import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';

// Exercise the shared clock with real recharge intervals, independently of profession trigger eligibility.
function fixture(rate = 1.25) {
  const profiles = new Map([
    [1, { id: 1, name: 'Fixed proc', internalCooldown: 10 }],
    [3, { id: 3, name: 'Summon skill', cooldown: 10, cooldownPolicy: 'summonRecharge' }]
  ]);
  const events = [];
  const timeline = createGw2TimelineIndex({ playerAlacrityRechargeRate: rate, events, resolved: true });
  const runtime = { time: 1, helpers: { balanceProfilesById: profiles }, query: { timeline } };
  return { procs: createProcRegistry(() => runtime), profiles, events };
}

for (const rate of [1, 1.25, 1.5]) {
  test(`internal cooldown ignores player recharge rate ${rate}`, () => {
    const { procs } = fixture(rate);
    assert.equal(procs.claim(1), true);
    assert.equal(procs.deadline(1), 11);
    assert.equal(procs.claim(1, 1, 11), false);
    assert.equal(procs.claim(1, 1, 11.001), true);
    assert.equal(procs.deadline(1), 11.001 + 10);
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

test('scoped recharges and replacement deadlines do not leak across proc owners', () => {
  const { procs } = fixture();
  assert.equal(procs.claim(3, 'fire', 1, 'pet-a'), true);
  assert.equal(procs.claim(3, 'water', 2, 'pet-a'), true);
  assert.equal(procs.deadline('fire'), 11);
  assert.equal(procs.deadline('water'), 12);
  procs.setDeadline('fire', 0);
  assert.equal(procs.deadline('fire'), 0);
  assert.equal(procs.claim(3, 'fire', 2, 'pet-a'), true);
  procs.setDeadline('fire', 50);
  assert.equal(procs.deadline('fire'), 50);
  assert.equal(procs.deadline('water'), 12);
  procs.claim(3, 3, 1, 'pet-a');
  procs.setDeadline('3', 0);
  assert.equal(procs.deadline(3), 0);
});

test('recharge profiles reject invalid work and obsolete ICD fields', () => {
  const { procs, profiles } = fixture();
  const profile = profiles.get(3);
  for (const cooldown of [undefined, -1, NaN, Infinity]) {
    profiles.set(3, { ...profile, cooldown });
    assert.throws(() => procs.claim(3, 3, 1, 'pet-a'));
    assert.equal(procs.deadline(3), 0);
  }

  profiles.set(3, { ...profile, internalCooldown: 10 });
  assert.throws(() => procs.claim(3, 3, 1, 'pet-a'), /not internalCooldown/);
  profiles.set(3, { ...profile, cooldownPolicy: 'typo' });
  assert.throws(() => procs.claim(3, 3, 1, 'pet-a'), /Invalid proc cooldown policy/);
  profiles.set(3, { ...profile, cooldown: 0 });
  assert.equal(procs.claim(3, 3, 1, 'pet-a'), true);
  assert.equal(procs.deadline(3), 1);
  assert.equal(procs.claim(3, 3, 1, 'pet-a'), false);
  assert.equal(procs.claim(3, 3, 1.000001, 'pet-a'), true);
});

// Both fixed-claim APIs replace summon work, and a later summon claim captures its new companion incarnation.
for (const [label, claimFixed] of [
  ['profile', (procs, key, at) => procs.claim(1, key, at)],
  ['explicit', (procs, key, at) => procs.claimCooldown(key, at, 10)]
]) {
  test(`timer kinds replace each other through ${label} claims`, () => {
    const { procs, events } = fixture();
    assert.equal(procs.claim(3, 3, 1, 'pet-a'), true);
    assert.equal(claimFixed(procs, '3', 11), false);
    assert.equal(claimFixed(procs, '3', 12), true);
    assert.equal(procs.deadline(3), 22);
    events.push({
      type: 'buff',
      at: 3,
      kind: 'alacrity',
      duration: 40,
      stacks: 1,
      resolvedAudience: {
        includesSelf: false,
        includesSummons: true,
        alliedPlayerCount: 0,
        recipientCount: 1,
        companionIds: ['pet-a']
      }
    });
    assert.equal(procs.deadline(3), 22);
    assert.equal(procs.claim(3, 3, 22, 'pet-b'), false);
    assert.equal(procs.claim(3, 3, 23, 'pet-b'), true);
    assert.equal(procs.deadline('3'), 33);
    events.push({ ...events[0], at: 25, resolvedAudience: { ...events[0].resolvedAudience, companionIds: ['pet-b'] } });
    assert.equal(procs.deadline(3), 31.4);
  });
}

// A rejected replacement must retain work ownership so subsequent boon grants can still affect its deadline.
test('failed fixed claims and explicit replacements preserve summon recharge work', () => {
  const { procs, events } = fixture();
  assert.equal(procs.claim(3, 3, 1, 'pet-a'), true);
  assert.equal(procs.claimCooldown('3', 11, NaN), false);
  assert.throws(() => procs.claimCooldown('3', 12, NaN), /duration/);
  assert.throws(() => procs.claimCooldown('3', 12, Number.MAX_VALUE), /safe integer microseconds/);
  assert.throws(() => procs.setDeadline('3', NaN), /readyAt/);
  assert.equal(procs.deadline(3), 11);
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
  assert.equal(procs.deadline(3), 10);
});

// Validate a new summon projection before replacing an existing fixed timer, including failures after profile checks.
test('invalid summon claims preserve the existing fixed deadline', () => {
  const { procs, profiles } = fixture();
  procs.setDeadline(3, 2);
  assert.equal(procs.claim(3, '3', 2), false);
  assert.throws(() => procs.claim(3, '3', 3), /companion identity/);
  assert.equal(procs.deadline(3), 2);
  const profile = profiles.get(3);
  for (const cooldown of [-1, Infinity, Number.MAX_VALUE]) {
    profiles.set(3, { ...profile, cooldown });
    assert.throws(() => procs.claim(3, '3', 3, 'pet-b'));
    assert.equal(procs.deadline(3), 2);
  }
});
