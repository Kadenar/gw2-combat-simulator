import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';

import { composeSkillMechanics } from '#tests/helpers/skill-mechanics.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_SKILL_IDS, ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { SPECIALIZATIONS as API_SPECIALIZATIONS } from '#gw2/professions/elementalist/data/elementalist-api-metadata.js';
import { TRAITS } from '#gw2/professions/elementalist/data/traits-data.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import { evokerModule } from '#gw2/professions/elementalist/specializations/evoker/module.js';
import {
  EVOKER_BALANCE_PROFILE_IDS,
  EVOKER_BALANCE_PROFILES
} from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/index.js';
import { tempestModule } from '#gw2/professions/elementalist/specializations/tempest/module.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/tempest/skills/index.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';

const slices = [
  ['core', elementalistCoreModule, ELEMENTALIST_CORE_SKILL_MECHANICS],
  ['specializations/tempest', tempestModule, TEMPEST_SKILL_MECHANICS],
  ['specializations/weaver', weaverModule, WEAVER_SKILL_MECHANICS],
  ['specializations/catalyst', catalystModule, CATALYST_SKILL_MECHANICS],
  ['specializations/evoker', evokerModule, EVOKER_SKILL_MECHANICS]
];

const ELEMENTALIST_SKILL_MECHANICS = composeSkillMechanics(
  'Elementalist',
  slices.map(([, , mechanics]) => mechanics)
);

const weaponFragmentOwners = [
  ['core', ELEMENTALIST_CORE_SKILL_MECHANICS],
  ['specializations/weaver', WEAVER_SKILL_MECHANICS]
];

function weaponSlug(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Discovers weapon sources and loads their compiled fragments through package aliases to verify a no-loss composition.
async function weaponFragments(directory) {
  const sourceDirectory = new URL(
    `../../../../../js/games/gw2/professions/elementalist/${directory}/skills/weapons/`,
    import.meta.url
  );
  return Promise.all(
    readdirSync(sourceDirectory)
      .filter((filename) => filename.endsWith('.ts'))
      .sort()
      .map(async (filename) => {
        const module = await import(
          `#gw2/professions/elementalist/${directory}/skills/weapons/${filename.replace(/\.ts$/, '.js')}`
        );
        const exports = Object.entries(module).filter(([name]) => name.endsWith('_SKILL_MECHANICS'));
        assert.equal(exports.length, 1, `${directory}/${filename}`);
        return [filename.replace(/\.ts$/, ''), exports[0][1]];
      })
  );
}

// Missing or duplicate skills break composition; filenames and source spelling do not define this contract.
test('Elementalist skill mechanics have disjoint module ownership', () => {
  const owners = new Map();

  for (const [directory, module, mechanics] of slices) {
    assert.deepEqual(Object.keys(module.data.skillMechanics).sort(), Object.keys(mechanics).sort(), directory);
    for (const skillId of Object.keys(mechanics)) {
      assert.equal(owners.has(skillId), false, skillId);
      owners.set(skillId, module.id);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    Object.keys(ELEMENTALIST_SKILL_MECHANICS).sort((left, right) => Number(left) - Number(right))
  );
  const declaredIds = new Set(Object.values(ELEMENTALIST_SKILL_IDS));

  for (const skillId of owners.keys()) {
    assert.equal(declaredIds.has(Number(skillId)), true, skillId);
  }
});

test('Elementalist weapon skill fragments compose without duplicates or omissions', async () => {
  for (const [directory, aggregate] of weaponFragmentOwners) {
    const owners = new Map();
    for (const [filename, mechanics] of await weaponFragments(directory)) {
      for (const [skillId, skill] of Object.entries(mechanics)) {
        assert.equal(skill.type, 'Weapon', `${directory}/${filename}:${skillId}`);
        assert.equal(weaponSlug(skill.weapon), filename, `${directory}/${filename}:${skillId}`);
        assert.equal(owners.has(skillId), false, `${directory}:${skillId}`);
        assert.equal(aggregate[skillId], skill, `${directory}:${skillId}`);
        owners.set(skillId, filename);
      }
    }

    const aggregateWeaponIds = Object.entries(aggregate)
      .filter(([, skill]) => skill.type === 'Weapon' && skill.weapon)
      .map(([skillId]) => skillId)
      .sort((left, right) => Number(left) - Number(right));
    assert.deepEqual(
      [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
      aggregateWeaponIds
    );
  }
});

test('Specialized Elements models percentage recharge changes as multipliers', () => {
  const profiles = new Map(EVOKER_BALANCE_PROFILES.map((profile) => [profile.id, profile]));
  const trait = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElements);
  const basic = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElementsBasicRecharge);
  const empowered = profiles.get(EVOKER_BALANCE_PROFILE_IDS.specializedElementsEmpoweredRecharge);

  assert.equal(Object.hasOwn(trait, 'rechargeReduction'), false);
  assert.equal(basic.rechargeMultiplier, 0.9);
  assert.equal(empowered.rechargeMultiplier, 0.67);
});

test('Elementalist trait and specialization IDs follow the API snapshot', () => {
  const apiTraits = API_SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]);

  assert.deepEqual(
    TRAITS.map((trait) => trait.id),
    apiTraits.map((trait) => trait.id)
  );
  assert.deepEqual(new Set(Object.values(ELEMENTALIST_TRAIT_IDS)), new Set(apiTraits.map((trait) => trait.id)));
  for (const trait of TRAITS) {
    assert.equal('stats' in trait, false, trait.name);
    assert.equal('durations' in trait, false, trait.name);
    assert.equal('criticalChance' in trait, false, trait.name);
  }
});
