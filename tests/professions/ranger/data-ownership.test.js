import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  RANGER_CORE_EXTRA_SKILLS,
  RANGER_CORE_BASE_SKILL_MECHANICS
} from '#gw2/professions/ranger/core/skills/index.js';
import { RANGER_CORE_ACTION_SKILLS } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { RANGER_CORE_AXE_EXTRA_SKILLS } from '#gw2/professions/ranger/core/skills/weapons/axe.js';
import { RANGER_CORE_SPEAR_EXTRA_SKILLS } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { SOULBEAST_BEAST_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beast-skills/index.js';
import { SOULBEAST_BEASTMODE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import { SOULBEAST_STANCE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';

const professionRoot = new URL('../../../js/games/gw2/professions/ranger/', import.meta.url);

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

// Loads family files directly so adding a pet cannot bypass the aggregate ownership contract.
async function familyFragments(relativeDirectory) {
  const directory = new URL(relativeDirectory, professionRoot);
  return Promise.all(
    readdirSync(directory)
      .filter((filename) => filename.endsWith('.ts') && filename !== 'index.ts')
      .sort()
      .map(async (filename) => {
        const source = readFileSync(new URL(filename, directory), 'utf8');
        assert.match(source, /^\/\*\*/);
        assert.match(source, /RANGER_SKILL_IDS\s+as\s+ID/);
        assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
        const module = await import(new URL(filename.replace(/\.ts$/, '.js'), directory));
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

test('Core Ranger pet catalogs follow generated pet-family ownership', async () => {
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
    assert.equal(RANGER_CORE_BASE_SKILL_MECHANICS[skillId], mechanics, skillId);
  }
});

test('Soulbeast Beast catalogs separate family, archetype, and legacy ownership', async () => {
  const fragments = await familyFragments('specializations/soulbeast/skills/beast-skills/');

  for (const [filename, mechanics] of fragments) {
    for (const skillId of Object.keys(mechanics)) {
      const owners = familiesUsing(skillId, 'beastmodeSkillIds');

      if (filename === 'archetype') {
        assert.ok(owners.length > 1, skillId);
        assert.equal(archetypesUsing(skillId).length, 1, skillId);
      } else if (filename === 'winged') {
        assert.deepEqual(new Set(owners), new Set(['phoenix', 'wyvern']), skillId);
      } else if (filename === 'supplemental') assert.equal(owners.length, 0, skillId);
      else assert.deepEqual(owners, [filename], skillId);
    }
  }

  assertDisjointComposition(SOULBEAST_BEAST_SKILL_MECHANICS, fragments);
  assertDisjointComposition(SOULBEAST_BASE_SKILL_MECHANICS, [
    ['beast-skills', SOULBEAST_BEAST_SKILL_MECHANICS],
    ['beastmode-skills', SOULBEAST_BEASTMODE_SKILL_MECHANICS],
    ['stance-skills', SOULBEAST_STANCE_SKILL_MECHANICS]
  ]);
});

test('Core Ranger supplemental identities compose from their semantic owners', () => {
  assert.deepEqual(RANGER_CORE_EXTRA_SKILLS, [
    ...RANGER_CORE_SPEAR_EXTRA_SKILLS,
    ...RANGER_CORE_AXE_EXTRA_SKILLS,
    ...RANGER_CORE_ACTION_SKILLS
  ]);
});

test('Ranger refresh and runtime cannot restore retired ownership paths', () => {
  for (const relativePath of [
    'core/skills.ts',
    'core/skills/hammer.ts',
    'core/skills/pet-skills.ts',
    'specializations/druid/skills.ts',
    'specializations/galeshot/skills.ts',
    'specializations/soulbeast/skills.ts',
    'specializations/untamed/skills.ts'
  ]) {
    assert.equal(existsSync(new URL(relativePath, professionRoot)), false, relativePath);
  }

  assert.equal(
    existsSync(new URL('../../../scripts/data/generate-ranger-skill-mechanics.mjs', import.meta.url)),
    false
  );
  assert.doesNotMatch(
    readFileSync(new URL('../../../scripts/data/update-ranger-data.mjs', import.meta.url), 'utf8'),
    /generateRangerSkillMechanics/
  );
});
