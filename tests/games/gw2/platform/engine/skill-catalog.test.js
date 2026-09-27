import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import {
  deriveAutoattackChains,
  indexAutoattackChains,
  resolveAutoattackChainStep
} from '#gw2/platform/engine/skills/autoattack-chains.js';

// Canonical catalogs normalize cast metadata and autoattack chains before execution.
test('canonical skills validate effective cast durations', () => {
  // Invalid authored durations must fail at catalog loading before they reach the scheduler.
  for (const castTimeMs of [-1, NaN, Infinity]) {
    assert.throws(
      () => createCanonicalCatalog({ generated: [{ id: 1, name: 'Invalid', castTimeMs }] }),
      /non-negative finite castTimeMs/
    );
  }

  const catalog = createCanonicalCatalog({ generated: [{ id: 1, name: 'Instant', effects: [] }] });
  assert.equal(catalog.skillsById.get(1).castTimeMs, 0);
});

// Reject invalid autonomous animation metadata before it can corrupt a creature's task clock.
test('summon strike animation metadata validates duration and ownership', () => {
  const load = (patch) =>
    createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Summon attack',
          effects: [{ type: 'strike', actorType: 'summon', coefficient: 1, castTimeMs: 800, ...patch }]
        }
      ]
    });
  assert.equal(load({}).skillsById.get(1).effects[0].castTimeMs, 800);
  for (const patch of [
    { castTimeMs: -1 },
    { castTimeMs: NaN },
    { castTimeMs: Infinity },
    { castTimeMs: '800' },
    { actorType: 'player' },
    { type: 'blind' }
  ]) {
    assert.throws(() => load(patch), /castTimeMs/);
  }
});

test('shared autoattack helpers derive and index ID-based chains', () => {
  const chains = deriveAutoattackChains([
    { id: 1, type: 'Weapon', slot: 'Weapon_1', nextChainId: 2 },
    { id: 2, type: 'Weapon', slot: 'Weapon_1', nextChainId: 3 },
    { id: 3, type: 'Weapon', slot: 'Weapon_1', nextChainId: null }
  ]);

  assert.deepEqual(chains, [[1, 2, 3]]);
  assert.deepEqual(indexAutoattackChains(chains).get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3
  });
});

test('shared autoattack helper resolves root and progressed chain expectations', () => {
  const positions = indexAutoattackChains([[1, 2, 3]]);

  assert.deepEqual(resolveAutoattackChainStep(positions, {}, 1), {
    position: positions.get(1),
    expectedSkillId: 1,
    matchesExpectedStep: true
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 1), {
    position: positions.get(1),
    expectedSkillId: 2,
    matchesExpectedStep: false
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 2), {
    position: positions.get(2),
    expectedSkillId: 2,
    matchesExpectedStep: true
  });
  assert.equal(resolveAutoattackChainStep(positions, { 1: 2 }, 99), null);
});

test('canonical catalogs own derived and exceptional autoattack chains', () => {
  const skill = (id, nextChainId = null, type = 'Weapon') => ({
    id,
    name: `Skill ${id}`,
    type,
    slot: type === 'Weapon' ? 'Weapon_1' : 'Profession_1',
    nextChainId
  });
  const catalog = createCanonicalCatalog({
    generated: [
      skill(1, 2),
      skill(2, 3),
      skill(3),
      skill(4, 5),
      skill(5),
      skill(6, null, 'Profession'),
      skill(7, null, 'Profession')
    ],
    autoattackChains: {
      excludeSkillIds: [5],
      additional: [[6, 7]]
    }
  });

  assert.deepEqual(catalog.autoattackChains, [
    [1, 2, 3],
    [6, 7]
  ]);
  assert.deepEqual(catalog.autoattackChainPositions.get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3
  });
  assert.equal(catalog.skillsById.get(2).chainRoot, 1);
  assert.equal(catalog.skillsById.get(2).chainStep, 2);
  assert.equal(catalog.skillsById.get(4).chainRoot, null);
  assert.equal(catalog.skillsById.get(5).chainStep, null);
  assert.equal(catalog.skillsById.get(7).chainRoot, 6);
});

// Reject malformed declarations before runtime execution can partially mutate combat state.
test('catalogs validate side-effect payloads, amounts, and variant references', () => {
  const load = (extra) =>
    createCanonicalCatalog({
      generated: [
        { id: 1, name: 'Action', effects: [], ...extra },
        { id: 2, name: 'Ammo', ammo: 2, effects: [] }
      ],
      balanceProfiles: [{ id: 'test.profile', name: 'Profile', profileKind: 'trait', resourceGain: 3, effects: [] }]
    });
  const declaration = (action) => ({ sideEffects: [{ on: 'castComplete', do: action }] });
  for (const action of [
    { type: 'rechargeReset', skillIds: [2] },
    { type: 'ammoRestore', skillIds: [2], count: 1 },
    { type: 'resourceGrant', resource: 'endurance', amount: { profile: 'test.profile', field: 'resourceGain' } },
    { type: 'flipArm', skillId: 2, durationSec: 1 },
    { type: 'flipArm', skillId: 2, durationSec: 1, expiryPriority: -220 },
    { type: 'emitProfile', profileId: 'test.profile' },
    { type: 'test.action', amount: 0 }
  ])
    assert.doesNotThrow(() => load(declaration(action)));
  for (const action of [
    { type: 'rechargeReset', skillIds: '2' },
    { type: 'rechargeReset', skillIds: [99] },
    { type: 'ammoRestore', skillIds: [1], count: 1 },
    { type: 'ammoRestore', skillIds: [2], count: -1 },
    { type: 'resourceGrant', resource: 'missing', amount: 1 },
    ...[
      -1,
      Infinity,
      NaN,
      '3',
      {},
      { profile: 'missing', field: 'resourceGain' },
      { profile: 'test.profile', field: 'missing' }
    ].map((amount) => ({ type: 'resourceGrant', resource: 'endurance', amount })),
    { type: 'flipArm', skillId: 99, durationSec: 1 },
    { type: 'flipArm', skillId: 2 },
    ...[NaN, Infinity, 'early'].map((expiryPriority) => ({
      type: 'flipArm',
      skillId: 2,
      durationSec: 1,
      expiryPriority
    })),
    { type: 'emitProfile', profileId: 'missing' },
    { type: 'emitProfile', profileId: 'test.profile', attribution: [] },
    { type: 'typo' }
  ])
    assert.throws(() => load(declaration(action)), TypeError);
  for (const extra of [
    { sideEffects: {} },
    { sideEffects: [null] },
    { effectVariants: {} },
    { effectVariants: [null] },
    { effectVariants: [{ when: () => true, profileId: 'missing' }] }
  ])
    assert.throws(() => load(extra), TypeError);
  assert.doesNotThrow(() => load({ effectVariants: [{ when: () => true, profileId: 'test.profile' }] }));
});

// Resource declarations resolve a live field on their own skill and reject missing or nonnumeric tuning at loading.
test('resource grants validate current-skill amounts without accepting them for unrelated actions', () => {
  const load = (resourceGain, action) =>
    createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Reward',
          resourceGain,
          effects: [],
          sideEffects: [
            {
              on: 'castCommit',
              do: action ?? {
                type: 'resourceGrant',
                resource: 'endurance',
                amount: { skillField: 'resourceGain' }
              }
            }
          ]
        }
      ]
    });
  for (const value of [0, 17.5]) assert.doesNotThrow(() => load(value));
  for (const value of [undefined, -1, Infinity, NaN, '17']) assert.throws(() => load(value), TypeError);
  for (const amount of [
    { skillField: 'missing' },
    { skillField: 'name' },
    { skillField: 'resourceGain', profile: 'extra' },
    { skillField: 3 }
  ])
    assert.throws(() => load(17, { type: 'resourceGrant', resource: 'endurance', amount }), TypeError);
  assert.throws(
    () => load(17, { type: 'flipArm', skillId: 1, durationSec: { skillField: 'resourceGain' } }),
    TypeError
  );
});
