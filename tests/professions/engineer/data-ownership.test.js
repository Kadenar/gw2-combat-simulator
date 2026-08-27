import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '../../../js/games/gw2/content/professions/engineer/core/skills.js';
import { ENGINEER_SKILL_IDS } from '../../../js/games/gw2/content/professions/engineer/data/ids.js';

const KIT_SLUGS = new Map([
  ['Med Kit', 'med-kit'],
  ['Grenade Kit', 'grenade-kit'],
  ['Bomb Kit', 'bomb-kit'],
  ['Tool Kit', 'tool-kit'],
  ['Flamethrower', 'flamethrower'],
  ['Elixir Gun', 'elixir-gun'],
  ['Elite Mortar Kit', 'elite-mortar-kit']
]);

function ownedKit(skill) {
  return [skill.kitName, skill.kit, skill.toolbeltParentName].find((name) => KIT_SLUGS.has(name));
}

// Loads every Core kit fragment so the aggregate contract proves disjoint ownership without a hand-maintained file list.
async function kitFragments() {
  const directory = new URL('../../../js/games/gw2/content/professions/engineer/core/skill-data/', import.meta.url);
  return Promise.all(
    readdirSync(directory)
      .filter((filename) => filename.endsWith('.ts'))
      .sort()
      .map(async (filename) => {
        const source = readFileSync(new URL(filename, directory), 'utf8');
        assert.match(source, /ENGINEER_SKILL_IDS\s+as\s+ID/);
        assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
        const module = await import(new URL(filename.replace(/\.ts$/, '.js'), directory));
        const mechanicsExports = Object.entries(module).filter(([name]) => name.endsWith('_SKILL_MECHANICS'));
        assert.equal(mechanicsExports.length, 1, filename);
        return {
          filename: filename.replace(/\.ts$/, ''),
          mechanics: mechanicsExports[0][1],
          extraSkills: Object.values(module).find(
            (value) => Array.isArray(value) && value.some((skill) => skill?.id != null)
          )
        };
      })
  );
}

test('Engineer kit skill-data fragments compose without duplicates or omissions', async () => {
  const owners = new Map();
  const fragmentExtraSkills = [];

  for (const { filename, mechanics, extraSkills = [] } of await kitFragments()) {
    for (const [skillId, skill] of Object.entries(mechanics)) {
      const kitName = ownedKit(skill);
      assert.ok(kitName, `${filename}:${skillId}`);
      assert.equal(KIT_SLUGS.get(kitName), filename, `${filename}:${skillId}`);
      assert.equal(owners.has(skillId), false, skillId);
      assert.equal(ENGINEER_CORE_SKILL_MECHANICS[skillId], skill, skillId);
      owners.set(skillId, filename);
    }

    fragmentExtraSkills.push(...extraSkills);
  }

  const aggregateKitIds = Object.entries(ENGINEER_CORE_SKILL_MECHANICS)
    .filter(([, skill]) => ownedKit(skill))
    .map(([skillId]) => skillId)
    .sort((left, right) => Number(left) - Number(right));
  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    aggregateKitIds
  );

  assert.deepEqual(
    fragmentExtraSkills.map((skill) => skill.id),
    [ENGINEER_SKILL_IDS.STOW_ELITE_MORTAR_KIT]
  );
  assert.ok(ENGINEER_CORE_EXTRA_SKILLS.includes(fragmentExtraSkills[0]));
});
