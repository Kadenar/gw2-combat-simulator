import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import {
  deriveAutoattackChains,
  indexAutoattackChains,
  resolveAutoattackChainStep
} from '#gw2/platform/engine/skills/autoattack-chains.js';

// Canonical catalogs normalize cast metadata and autoattack chains before execution.
test('canonical skills derive base casts and can opt out of Quickness', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930000,
        name: 'Derived Base Cast',
        quicknessCastTimeMs: 600,
        effects: []
      },
      {
        id: 930001,
        name: 'Quickness Immune Cast',
        castTimeMs: 700,
        unaffectedByQuickness: true,
        effects: []
      }
    ]
  });

  assert.deepEqual(
    [catalog.skillsById.get(930000).castTimeMs, catalog.skillsById.get(930000).quicknessCastTimeMs],
    [900, 600]
  );
  assert.deepEqual(
    [catalog.skillsById.get(930001).castTimeMs, catalog.skillsById.get(930001).unaffectedByQuickness],
    [700, true]
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930002,
            name: 'Conflicting Quickness Cast',
            castTimeMs: 700,
            quicknessCastTimeMs: 500,
            unaffectedByQuickness: true
          }
        ]
      }),
    /cannot specify quicknessCastTimeMs/
  );
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
