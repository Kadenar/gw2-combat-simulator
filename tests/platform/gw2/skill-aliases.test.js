import assert from 'node:assert/strict';
import test from 'node:test';

import { engineerCatalog } from '#gw2/content/professions/engineer/catalog.js';
import { createEngineerBuildDefaults, migrateEngineerBuild } from '#gw2/content/professions/engineer/build/build.js';
import { engineerNativeModules } from '#gw2/content/professions/engineer/modules.js';
import { guardianCatalog } from '#gw2/content/professions/guardian/catalog.js';
import { guardianNativeModules } from '#gw2/content/professions/guardian/modules.js';
import { necromancerCatalog } from '#gw2/content/professions/necromancer/catalog.js';
import { necromancerNativeModules } from '#gw2/content/professions/necromancer/modules.js';
import { revenantCatalog } from '#gw2/content/professions/revenant/catalog.js';
import { revenantNativeModules } from '#gw2/content/professions/revenant/modules.js';
import { thiefCatalog } from '#gw2/content/professions/thief/catalog.js';
import { thiefNativeModules } from '#gw2/content/professions/thief/modules.js';
import { warriorCatalog } from '#gw2/content/professions/warrior/catalog.js';
import { warriorNativeModules } from '#gw2/content/professions/warrior/modules.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { canonicalGw2SkillId, GW2_SKILL_ID_ALIASES } from '#gw2/platform/skills/aliases.js';

const ALIASES = Object.entries(GW2_SKILL_ID_ALIASES).map(([alias, canonical]) => [Number(alias), canonical]);
const CATALOGS = [warriorCatalog, guardianCatalog, engineerCatalog, thiefCatalog, necromancerCatalog, revenantCatalog];
const MODULES = [
  ...warriorNativeModules,
  ...guardianNativeModules,
  ...engineerNativeModules,
  ...thiefNativeModules,
  ...necromancerNativeModules,
  ...revenantNativeModules
];

test('the reviewed alias inventory resolves directly to existing canonical skills', () => {
  assert.equal(ALIASES.length, 46);

  for (const [alias, canonical] of ALIASES) {
    assert.equal(canonicalGw2SkillId(alias), canonical, String(alias));
    assert.ok(
      CATALOGS.some((catalog) => catalog.skillsById.has(canonical)),
      String(canonical)
    );
    assert.equal(
      CATALOGS.some((catalog) => catalog.skillsById.has(alias)),
      false,
      `${alias} must remain compatibility-only`
    );
    assert.equal(Object.hasOwn(GW2_SKILL_ID_ALIASES, canonical), false, `${alias} must not form an alias chain`);
  }
});

test('numeric rotation aliases produce the same canonical actions while unknown IDs stay unchanged', () => {
  for (const [alias, canonical] of ALIASES) {
    assert.deepEqual(normalizeRotation([alias]), normalizeRotation([canonical]), String(alias));
    assert.deepEqual(
      normalizeRotation([{ type: 'cast', skillId: alias }]),
      normalizeRotation([{ type: 'cast', skillId: canonical }]),
      String(alias)
    );
  }

  assert.deepEqual(normalizeRotation([999999, '999999']), [
    { type: 'cast', skillId: 999999 },
    { type: 'cast', skillId: '999999' }
  ]);
});

test('every canonical alias target has exactly one behavioral owner', () => {
  // Module mechanics expose duplicate ownership that an assembled ID map would otherwise hide.
  for (const canonicalId of new Set(ALIASES.map(([, canonical]) => canonical))) {
    const owners = MODULES.filter((module) => Object.hasOwn(module.data.skillMechanics || {}, canonicalId));

    assert.equal(owners.length, 1, `${canonicalId} owners: ${owners.map((module) => module.id).join(', ') || 'none'}`);
  }
});

test('combat-log and legacy selected-skill loading use the shared alias map', () => {
  const profile = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'spellbreaker');
  const deadeye = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'deadeye');
  const antiquary = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'antiquary');
  const renegade = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'renegade');
  const conduit = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'conduit');

  assert.ok(profile);
  assert.ok(renegade);
  assert.ok(conduit);

  // Profession-specific log transforms must not duplicate IDs owned by the global compatibility inventory.
  for (const candidate of ROTATION_PROFILES) {
    for (const rawSkillId of Object.keys(candidate.skillIdAliases)) {
      assert.equal(Object.hasOwn(GW2_SKILL_ID_ALIASES, rawSkillId), false, rawSkillId);
    }
  }

  assert.equal(findRotationSkill(69297, 'Unknown', warriorCatalog, profile)?.id, 45252);
  assert.equal(findRotationSkill(80278, 'Unknown', thiefCatalog, deadeye)?.id, 40436);
  assert.equal(findRotationSkill(76744, 'Unknown', thiefCatalog, antiquary)?.id, 77230);
  assert.equal(findRotationSkill(29082, 'Unknown', revenantCatalog, renegade)?.id, 27025);
  assert.equal(findRotationSkill(46409, 'Unknown', revenantCatalog, renegade)?.id, 41858);
  assert.equal(findRotationSkill(76917, 'Unknown', revenantCatalog, conduit)?.id, 76805);
  assert.equal(findRotationSkill(77159, 'Unknown', revenantCatalog, conduit)?.id, 77141);

  const { selectedSkills: _selectedSkills, ...legacyBuild } = createEngineerBuildDefaults();
  const migrated = migrateEngineerBuild({ ...legacyBuild, selectedSkillIds: [29991] });

  assert.equal(migrated.selectedSkills.Utility1, 'Personal Battering Ram');
});

test('protected variants and unreviewed IDs remain distinct', () => {
  // Phase 6 retained records either differ behaviorally or still lack an external identity relationship.
  for (const skillId of [
    9224, 41746, 73006, 73042, 30893, 76550, 76800, 40601, 41110, 41330, 42707, 42803, 43566, 71922, 71950, 72089,
    73014, 15834, 42371, 5817, 6091, 6092, 30337, 45094, 16460, 71967, 76601, 76900, 77288, 72058
  ]) {
    assert.equal(canonicalGw2SkillId(skillId), skillId);
  }
});
