// Catalog relationships come only from declarations, independent of imported labels and links.
import assert from 'node:assert/strict';
import test from 'node:test';

import { armSkillFlip, weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

const skills = [1, 2, 3, 4].map((id) => ({ id, name: 'Shared name' }));

test('declared weapon flips retain their availability transition despite imported next-chain evidence', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      { id: 1, name: 'Parent', type: 'Weapon', nextChainId: 2 },
      { id: 2, name: 'Follow-up', type: 'Weapon' }
    ],
    skillFlips: [{ parentId: 1, followUpId: 2 }]
  });
  const parent = catalog.skillsById.get(1);
  const child = catalog.skillsById.get(2);
  const flips = {};
  assert.equal(weaponFlipBlock(flips, catalog.skillsById, child, 0).kind, 'closed');
  armSkillFlip(flips, child.id, 0, 5);
  assert.equal(weaponFlipBlock(flips, catalog.skillsById, child, 0), null);
  assert.equal(weaponFlipBlock(flips, catalog.skillsById, parent, 0).kind, 'open');
  assert.equal(weaponFlipBlock(flips, catalog.skillsById, parent, 5), null);
});

test('imported and override links cannot create undeclared runtime flips', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      { ...skills[0], flipSkillId: 2, nextChainId: 2 },
      { ...skills[1], flipParentId: 1, nextChainId: 1 }
    ],
    overrides: { 1: { flipSkillId: 2 } }
  });
  assert.deepEqual(catalog.skillFlips, []);
  for (const skill of catalog.skills) {
    assert.equal(skill.flipSkillId, null);
    assert.equal(skill.flipParentId, null);
  }
});

test('declared same-name flips survive renaming, absent API links, and contradictory API links', () => {
  const skillFlips = [
    { parentId: 1, followUpId: 2 },
    { parentId: 2, followUpId: 3 }
  ];
  for (const imported of [false, true]) {
    for (const renamed of [false, true]) {
      const catalog = createCanonicalCatalog({
        skills: skills.map((skill) => ({
          ...skill,
          name: renamed ? `Renamed ${skill.id}` : skill.name,
          ...(imported ? { flipSkillId: 4, flipParentId: 4 } : {})
        })),
        skillFlips
      });
      assert.deepEqual(catalog.skillFlips, skillFlips);
      assert.equal(catalog.skillsById.get(1).flipSkillId, 2);
      assert.equal(catalog.skillsById.get(2).flipParentId, 1);
      assert.equal(catalog.skillsById.get(2).flipSkillId, 3);
      assert.equal(catalog.skillsById.get(3).flipParentId, 2);
      assert.equal(catalog.skillsById.get(4).flipParentId, null);
      assert.equal(catalog.skillsById.get(4).flipSkillId, null);
    }
  }
});

test('secondary commands share a parent while one declared follow-up owns the default face', () => {
  const declarations = [
    { parentId: 1, followUpId: 2 },
    { parentId: 1, followUpId: 3, defaultFollowUp: false }
  ];
  const catalog = createCanonicalCatalog({ skills, skillFlips: declarations });
  assert.equal(catalog.skillsById.get(1).flipSkillId, 2);
  assert.equal(catalog.skillsById.get(2).flipParentId, 1);
  assert.equal(catalog.skillsById.get(3).flipParentId, 1);
  declarations[0].followUpId = 4;
  assert.equal(catalog.skillFlips[0].followUpId, 2);
  assert.ok(Object.isFrozen(catalog.skillFlips));
  assert.ok(Object.isFrozen(catalog.skillFlips[0]));
});

test('invalid flip declarations fail assembly instead of silently selecting a winner', () => {
  for (const [skillFlips, pattern] of [
    [[{ parentId: 1, followUpId: 99 }], /missing skill/],
    [[{ parentId: 99, followUpId: 1 }], /missing skill/],
    [[{ parentId: 1, followUpId: 1 }], /self-reference/],
    [
      [
        { parentId: 1, followUpId: 2 },
        { parentId: 3, followUpId: 2 }
      ],
      /duplicate parent/
    ],
    [
      [
        { parentId: 1, followUpId: 2 },
        { parentId: 1, followUpId: 2 }
      ],
      /duplicate parent/
    ],
    [
      [
        { parentId: 1, followUpId: 2 },
        { parentId: 1, followUpId: 3 }
      ],
      /multiple default/
    ],
    [
      [
        { parentId: 1, followUpId: 2 },
        { parentId: 2, followUpId: 1 }
      ],
      /cycle/
    ]
  ])
    assert.throws(() => createCanonicalCatalog({ skills, skillFlips }), pattern);
  assert.throws(
    () =>
      createCanonicalCatalog({
        skills,
        autoattackChains: [[1, 2]],
        skillFlips: [{ parentId: 1, followUpId: 2 }]
      }),
    /Autoattack chain members/
  );
});

test('flip declarations cannot cross independently selectable runtime modules', () => {
  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        { id: 'Core', data: { skills: [skills[0]], skillFlips: [{ parentId: 1, followUpId: 2 }] } },
        { id: 'Elite', data: { skills: [skills[1]] } }
      ]),
    /skill flip crosses runtime module ownership/
  );
});

for (const professionId of [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
]) {
  test(`${professionId} retains exactly the declared flip families in each selected catalog`, async () => {
    const exports = await import(`#gw2/professions/${professionId}/profession.js`);
    const profession = exports[`${professionId}Profession`];
    const modules = exports[`${professionId}NativeModules`];
    const declared = modules.flatMap((module) => module.data.skillFlips ?? []);
    assert.deepEqual(profession.catalog.skillFlips, declared);
    for (const module of modules) {
      const catalog = profession.runtimeFor({ specialization: module.id }).catalog;
      const expected = declared.filter((flip) => catalog.skillsById.has(flip.parentId));
      const keys = (flips) => flips.map((flip) => `${flip.parentId}:${flip.followUpId}`).sort();
      assert.deepEqual(keys(catalog.skillFlips), keys(expected), module.id);
      for (const skill of catalog.skills) {
        const parent = expected.find((flip) => flip.followUpId === skill.id)?.parentId ?? null;
        const followUp =
          expected.find((flip) => flip.parentId === skill.id && flip.defaultFollowUp !== false)?.followUpId ?? null;
        assert.equal(skill.flipParentId, parent);
        assert.equal(skill.flipSkillId, followUp);
      }
    }
  });
}
