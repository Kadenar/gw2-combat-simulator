import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { assertComposedCatalog } from '../../helpers/skill-mechanics.js';

import { SKILLS as ELEMENTALIST_SKILLS } from '#gw2/professions/elementalist/data/elementalist-api-metadata.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '#gw2/professions/engineer/core/skills/index.js';
import { ENGINEER_TRAIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/trait-skills.js';
import { ENGINEER_SKILL_IDS } from '#gw2/professions/engineer/data/ids.js';
import { AMALGAM_EVOLVED_STATE_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import { AMALGAM_PROTOCOL_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/protocol-skills.js';
import { HOLOSMITH_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import { HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/photon-forge-skills.js';
import { HOLOSMITH_SLOT_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import { HOLOSMITH_SWORD_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/index.js';
import { MECHANIST_MECH_ATTACK_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/mech-attack-skills.js';
import { MECHANIST_MECH_COMMAND_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/mech-command-skills.js';
import { MECHANIST_SIGNET_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { warriorCatalog } from '#gw2/professions/warrior/profession.js';

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

// Discovers Core kit sources and loads their compiled fragments through package aliases to verify disjoint ownership.
async function kitFragments() {
  const directory = new URL('../../../js/games/gw2/professions/engineer/core/skills/kits/', import.meta.url);
  return Promise.all(
    readdirSync(directory)
      .filter((filename) => filename.endsWith('.ts'))
      .sort()
      .map(async (filename) => {
        const source = readFileSync(new URL(filename, directory), 'utf8');
        assert.match(source, /ENGINEER_SKILL_IDS\s+as\s+ID/);
        assert.doesNotMatch(source, /^\s*["']?-?\d+["']?\s*:/m);
        const module = await import(`#gw2/professions/engineer/core/skills/kits/${filename.replace(/\.ts$/, '.js')}`);
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
  const coreEntries = Object.entries(ENGINEER_TRAIT_SKILL_MECHANICS);

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

test('Engineer omits obsolete supplemental identities without removing native profession identities', () => {
  // Unsupported transforms, auxiliary actions, and the stale Jump Shot variant stay out of Engineer.
  for (const id of [5817, 10661, 10662, 10663, 13516, 15796, 17815, 26027, 29902, 30686, 40168])
    assert.equal(engineerCatalog.skillsById.has(id), false, id);
  for (const name of [
    'Withering Plague',
    'Plague of Darkness',
    'Plague of Pestilence',
    'Ally Ward',
    'Plague',
    'Glue Trail',
    'Overfueled Flame Jet',
    'Drop Gunk',
    'Long-Fused Powder Pack',
    'Throw Junk (Doppelganger)'
  ])
    assert.equal(engineerCatalog.skillsByName.has(name), false, name);

  assert.equal(engineerCatalog.skillsByName.get('Jump Shot').id, 6005);
  assert.equal(ELEMENTALIST_SKILLS.find((skill) => skill.name === 'Tornado').id, 5534);
  assert.equal(warriorCatalog.skillsByName.get('Rampage').id, 14483);
  assert.equal(necromancerCatalog.skillsByName.get('Lich Form').id, 10550);
});
