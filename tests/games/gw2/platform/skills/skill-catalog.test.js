import assert from 'node:assert/strict';
import test from 'node:test';

import { indexAutoattackChains, resolveAutoattackChainStep } from '#gw2/platform/skills/autoattack-chain-index.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

test('costs require one nonnegative finite amount and reject other amount sources', () => {
  // A cost must resolve unambiguously before a runtime can admit or spend it.
  const load = (amount, extra = {}) =>
    createCanonicalCatalog({
      skills: [{ id: 1, name: 'Fixed cost', cost: { resource: 'endurance', amount, ...extra } }]
    });
  for (const amount of [0, 0.5, 50]) assert.doesNotThrow(() => load(amount));
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => load(amount), /field=cost.amount/);
  for (const amount of [undefined, '50']) assert.throws(() => load(amount), /invalid cost declaration/);
  assert.throws(() => load(50, { skillAmount: 'resourceCost' }), /invalid cost declaration/);
});

test('shared autoattack helpers index explicit ID-based chains', () => {
  const chains = [[1, 2, 3]];
  assert.deepEqual(indexAutoattackChains(chains).get(2), {
    rootSkillId: 1,
    index: 1,
    nextSkillId: 3
  });
});

test('shared autoattack helper resolves root and progressed chain expectations', () => {
  const positions = indexAutoattackChains([[1, 2, 3]]);

  assert.deepEqual(resolveAutoattackChainStep(positions, {}, 1), {
    expectedSkillId: 1,
    matchesExpectedStep: true
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 1), {
    expectedSkillId: 2,
    matchesExpectedStep: false
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 2), {
    expectedSkillId: 2,
    matchesExpectedStep: true
  });
  assert.equal(resolveAutoattackChainStep(positions, { 1: 2 }, 99), null);
});

// Authored sequences alone determine membership; previously derived links cannot silently introduce another chain.
test('canonical catalogs own explicit weapon and transformed autoattack chains', () => {
  const skill = (id, nextChainId = null, type = 'Weapon') => ({
    id,
    name: `Skill ${id}`,
    type,
    slot: type === 'Weapon' ? 'Weapon_1' : 'Profession_1',
    nextChainId
  });
  const catalog = createCanonicalCatalog({
    skills: [
      skill(1, 2),
      skill(2, 3),
      skill(3),
      skill(4, 5),
      skill(5),
      skill(6, null, 'Profession'),
      skill(7, null, 'Profession')
    ],
    autoattackChains: [
      [1, 2, 3],
      [6, 7]
    ]
  });

  assert.deepEqual(catalog.autoattackChains, [
    [1, 2, 3],
    [6, 7]
  ]);
  assert.deepEqual(catalog.autoattackChainPositions.get(2), {
    rootSkillId: 1,
    index: 1,
    nextSkillId: 3
  });
  assert.equal(catalog.skillsById.get(2).chainRoot, 1);
  assert.equal(catalog.skillsById.get(2).chainStep, 2);
  assert.equal(catalog.skillsById.get(4).chainRoot, null);
  assert.equal(catalog.skillsById.get(5).chainStep, null);
  assert.equal(catalog.skillsById.get(7).chainRoot, 6);
  for (const id of [1, 2, 3, 6, 7]) assert.equal(catalog.skillsById.get(id).autoattack, true);
});

test('explicit chain order replaces previously derived links and clears intra-chain flips', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      { id: 1, name: 'First', nextChainId: 3, flipSkillId: 2 },
      { id: 2, name: 'Second', nextChainId: 1, flipParentId: 1 },
      { id: 3, name: 'Last', nextChainId: 1, flipSkillId: 4 },
      { id: 4, name: 'Separate flip', flipParentId: 3 }
    ],
    autoattackChains: [[1, 2, 3]],
    skillFlips: [{ parentId: 3, followUpId: 4 }]
  });
  assert.equal(catalog.skillsById.get(1).nextChainId, 2);
  assert.equal(catalog.skillsById.get(2).nextChainId, 3);
  assert.equal(catalog.skillsById.get(3).nextChainId, null);
  assert.equal(catalog.skillsById.get(1).flipSkillId, null);
  assert.equal(catalog.skillsById.get(2).flipParentId, null);
  assert.equal(catalog.skillsById.get(3).flipSkillId, 4);
  assert.equal(catalog.skillsById.get(4).flipParentId, 3);
});

test('manual sequences retain their explicit input classification', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      { id: 1, name: 'Manual opener', autoattack: false },
      { id: 2, name: 'Manual follow-up', autoattack: false }
    ],
    autoattackChains: [[1, 2]]
  });
  assert.equal(catalog.skillsById.get(1).autoattack, false);
  assert.equal(catalog.skillsById.get(2).autoattack, false);
  assert.equal(catalog.skillsById.get(2).chainRoot, 1);
});

test('catalogs reject malformed, overlapping, and missing chain declarations', () => {
  const load = (autoattackChains) =>
    createCanonicalCatalog({
      skills: [1, 2, 3].map((id) => ({ id, name: `Skill ${id}` })),
      autoattackChains
    });
  for (const value of [
    null,
    {},
    [1, 2],
    [[1]],
    [
      [1, 2],
      [2, 3]
    ],
    [[1, 1]],
    [[1, 99]]
  ]) {
    assert.throws(() => load(value), TypeError);
  }

  assert.deepEqual(load([]).autoattackChains, []);
});

// Reject malformed declarations before runtime execution can partially mutate combat state.
test('catalogs validate side-effect payloads, amounts, and variant references', () => {
  const load = (extra) =>
    createCanonicalCatalog({
      skills: [
        { id: 1, name: 'Action', effects: [], ...extra },
        { id: 2, name: 'Ammo', ammo: 2, effects: [] }
      ],
      balanceProfiles: [{ id: 'test.profile', name: 'Profile', resourceGain: 3, effects: [] }]
    });
  const declaration = (action) => ({ sideEffects: [{ on: 'castCommit', do: action }] });
  for (const action of [
    { type: 'rechargeReset', skillIds: [2] },
    { type: 'ammoRestore', skillIds: [2], count: 1 },
    { type: 'resourceGrant', resource: 'endurance', amount: { profile: 'test.profile', field: 'resourceGain' } },
    { type: 'flipArm', skillId: 2, durationSec: 1 },
    { type: 'flipArm', skillId: 2, durationSec: 10, uses: 3 },
    { type: 'flipArm', skillId: 2, durationSec: null },
    { type: 'flipConsume', skillId: 2 },
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
    ...[0, -1, 1.5, Infinity, NaN, '3'].map((uses) => ({ type: 'flipArm', skillId: 2, durationSec: 10, uses })),
    { type: 'flipConsume', skillId: 99 },
    { type: 'flipConsume' },
    ...[-1, Infinity, NaN, '3'].map((durationSec) => ({ type: 'flipArm', skillId: 2, durationSec })),
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
    // The removed lifecycle phase is rejected instead of silently retaining its old semantics.
    { sideEffects: [{ on: 'castComplete', do: { type: 'rechargeReset', skillIds: [2] } }] },
    { tasks: [{ type: 'test.task', timingAnchor: 'castComplete' }] },
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
      skills: [
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

// Aura declarations validate their name and duration as supported effects before any cast can apply them.
test('skill aura effects accept only a canonical aura with a positive finite duration', () => {
  const load = (aura) => createCanonicalCatalog({ skills: [{ id: 1, name: 'Aura', effects: aura ? [aura] : [] }] });
  for (const aura of [
    undefined,
    { type: 'aura', aura: 'Fire Aura', duration: 4 },
    { type: 'aura', aura: 'Shocking Aura', duration: 0.5 }
  ])
    assert.doesNotThrow(() => load(aura));
  for (const aura of [
    'Fire|4',
    ['Fire Aura', 4],
    { type: 'aura', aura: 'Fire', duration: 4 },
    { type: 'aura', aura: 'Fire Aura' },
    { type: 'aura', aura: 'Fire Aura', duration: '4' },
    ...[0, -1, NaN, Infinity].map((duration) => ({ type: 'aura', aura: 'Fire Aura', duration }))
  ])
    assert.throws(() => load(aura), /aura|effect|duration/);
});
