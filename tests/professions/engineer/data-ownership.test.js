import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '#gw2/content/professions/engineer/core/skills/index.js';
import { ENGINEER_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/supplemental-skills.js';
import { ENGINEER_TRAIT_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/trait-skills.js';
import { ENGINEER_SKILL_IDS } from '#gw2/content/professions/engineer/data/ids.js';
import { AMALGAM_EVOLVED_STATE_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/index.js';
import { AMALGAM_PROTOCOL_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/protocol-skills.js';
import { HOLOSMITH_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/holosmith/skills/index.js';
import { HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/holosmith/skills/photon-forge-skills.js';
import { HOLOSMITH_SLOT_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import { HOLOSMITH_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/index.js';
import { MECHANIST_MECH_ATTACK_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/mech-attack-skills.js';
import { MECHANIST_MECH_COMMAND_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/mech-command-skills.js';
import { MECHANIST_SIGNET_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/signet-skills.js';

const KIT_SLUGS = new Map([
  ['Med Kit', 'med-kit'],
  ['Grenade Kit', 'grenade-kit'],
  ['Bomb Kit', 'bomb-kit'],
  ['Flamethrower', 'flamethrower'],
  ['Elixir Gun', 'elixir-gun'],
  ['Elite Mortar Kit', 'elite-mortar-kit']
]);

function ownedKit(skill) {
  return [skill.kitName, skill.kit, skill.toolbeltParentName].find((name) => KIT_SLUGS.has(name));
}

// Verifies a public owner catalog is exactly the disjoint union of its named family catalogs.
function assertComposedCatalog(aggregate, families) {
  const entries = families.flatMap((family) => Object.entries(family));

  assert.equal(new Set(entries.map(([skillId]) => skillId)).size, entries.length);
  assert.deepEqual(
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right)),
    entries.map(([skillId]) => skillId).sort((left, right) => Number(left) - Number(right))
  );
  for (const [skillId, fragment] of entries) assert.equal(aggregate[skillId], fragment, skillId);
}

// Loads every Core kit fragment so the aggregate contract proves disjoint ownership without a hand-maintained file list.
async function kitFragments() {
  const directory = new URL('../../../js/games/gw2/content/professions/engineer/core/skills/kits/', import.meta.url);
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

test('Engineer owner-local skill families compose without duplicates or omissions', () => {
  const coreFamilies = [ENGINEER_TRAIT_SKILL_MECHANICS, ENGINEER_SUPPLEMENTAL_SKILL_MECHANICS];
  const coreEntries = coreFamilies.flatMap((family) => Object.entries(family));

  assert.equal(new Set(coreEntries.map(([skillId]) => skillId)).size, coreEntries.length);
  for (const [skillId, fragment] of coreEntries)
    assert.equal(ENGINEER_CORE_SKILL_MECHANICS[skillId], fragment, skillId);

  assertComposedCatalog(HOLOSMITH_SKILL_MECHANICS, [
    HOLOSMITH_SWORD_SKILL_MECHANICS,
    HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS,
    HOLOSMITH_SLOT_SKILL_MECHANICS
  ]);
  assertComposedCatalog(MECHANIST_SKILL_MECHANICS, [
    MECHANIST_SIGNET_SKILL_MECHANICS,
    MECHANIST_MECH_COMMAND_SKILL_MECHANICS,
    MECHANIST_MECH_ATTACK_SKILL_MECHANICS
  ]);
  assertComposedCatalog(AMALGAM_SKILL_MECHANICS, [
    AMALGAM_PROTOCOL_SKILL_MECHANICS,
    AMALGAM_EVOLVED_STATE_SKILL_MECHANICS
  ]);
});
