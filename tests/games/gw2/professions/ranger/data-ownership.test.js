import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';

import { RANGER_CORE_SKILLS } from '#gw2/professions/ranger/core/skills/index.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { SOULBEAST_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/index.js';
import { SOULBEAST_BEASTMODE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import { SOULBEAST_STANCE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';

const professionRoot = new URL('../../../../../js/games/gw2/professions/ranger/', import.meta.url);

function familySlug(value) {
  return value.replace(/[^a-z0-9]+/g, '-');
}

function familiesUsing(skillId, field) {
  return [
    ...new Set(RANGER_PETS.filter((pet) => pet[field].includes(Number(skillId))).map((pet) => familySlug(pet.family)))
  ];
}

function archetypesUsing(skillId) {
  return [
    ...new Set(RANGER_PETS.filter((pet) => pet.beastmodeSkillIds.includes(Number(skillId))).map((pet) => pet.archetype))
  ];
}

// Discovers family sources and loads their compiled fragments through package aliases so every pet is checked.
async function familyFragments(relativeDirectory) {
  const directory = new URL(relativeDirectory, professionRoot);
  return Promise.all(
    readdirSync(directory)
      .filter((filename) => filename.endsWith('.ts') && !['index.ts', 'pet-skill.ts'].includes(filename))
      .sort()
      .map(async (filename) => {
        const module = await import(`#gw2/professions/ranger/${relativeDirectory}${filename.replace(/\.ts$/, '.js')}`);
        const exports = Object.entries(module).filter(([name]) => name.endsWith('_SKILL_MECHANICS'));

        assert.equal(exports.length, 1, filename);
        return [filename.replace(/\.ts$/, ''), exports[0][1]];
      })
  );
}

function assertDisjointComposition(aggregate, fragments) {
  const entries = fragments.flatMap(([, mechanics]) => Object.entries(mechanics));

  assert.equal(new Set(entries.map(([skillId]) => skillId)).size, entries.length);
  assert.deepEqual(
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right)),
    entries.map(([skillId]) => skillId).sort((left, right) => Number(left) - Number(right))
  );
  for (const [skillId, mechanics] of entries) assert.equal(aggregate[skillId], mechanics, skillId);
}

test('Core Ranger pet catalogs follow maintained pet-family ownership', async () => {
  const fragments = await familyFragments('core/skills/pets/');
  const expectedFamilies = [
    ...new Set(RANGER_PETS.flatMap((pet) => (pet.skillIds.length ? [familySlug(pet.family)] : [])))
  ].sort();

  assert.deepEqual(
    fragments.map(([filename]) => filename),
    expectedFamilies
  );
  for (const [filename, mechanics] of fragments) {
    for (const skillId of Object.keys(mechanics))
      assert.deepEqual(familiesUsing(skillId, 'skillIds'), [filename], skillId);
  }

  assertDisjointComposition(RANGER_CORE_PET_SKILL_MECHANICS, fragments);

  for (const [skillId, mechanics] of Object.entries(RANGER_CORE_PET_SKILL_MECHANICS)) {
    assert.deepEqual(
      RANGER_CORE_SKILLS.find((skill) => String(skill.id) === skillId),
      { ...mechanics, id: Number(skillId) },
      skillId
    );
  }
});

test('Soulbeast Beast catalogs follow family and archetype ownership', async () => {
  const fragments = await familyFragments('specializations/soulbeast/skills/beast-skills/');

  for (const [filename, mechanics] of fragments) {
    for (const skillId of Object.keys(mechanics)) {
      const owners = familiesUsing(skillId, 'beastmodeSkillIds');

      if (filename === 'archetype') {
        assert.ok(owners.length > 1, skillId);
        assert.equal(archetypesUsing(skillId).length, 1, skillId);
      } else if (filename === 'winged') {
        assert.deepEqual(new Set(owners), new Set(['phoenix', 'wyvern']), skillId);
      } else assert.deepEqual(owners, [filename], skillId);
    }
  }

  assertDisjointComposition(SOULBEAST_BEAST_SKILL_MECHANICS, fragments);
  assertDisjointComposition(SOULBEAST_BASE_SKILL_MECHANICS, [
    ['beast-skills', SOULBEAST_BEAST_SKILL_MECHANICS],
    ['beastmode-skills', SOULBEAST_BEASTMODE_SKILL_MECHANICS],
    ['stance-skills', SOULBEAST_STANCE_SKILL_MECHANICS]
  ]);
});
