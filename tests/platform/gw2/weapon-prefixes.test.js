import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild, replaceBuild } from '#gw2/app/build/state/persistence.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { mesmerAppAdapter } from '#gw2/content/professions/mesmer/app/app-definition.js';
import { applyMesmerBuildAttributeRules } from '#gw2/content/professions/mesmer/build/attributes.js';
import { mesmerProfession } from '#gw2/content/professions/mesmer/definition.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';

// Attribute assertions use the same calculator composed into the Mesmer adapter.
const calculateAttributes = createCalculateAttributes(applyMesmerBuildAttributeRules);
const defaults = () => createDefaultBuild(mesmerAppAdapter);

test('legacy weapon prefixes migrate onto the alternate weapon set', () => {
  const build = replaceBuild(
    {
      gear: {
        Weapon1: "Assassin's",
        Weapon2: "Viper's"
      }
    },
    mesmerAppAdapter
  );

  assert.deepEqual(build.alternateWeaponPrefixes, ["Assassin's", "Viper's"]);
  assert.equal(mesmerAppAdapter.profession.validateBuild(build).valid, true);
});

test('invalid alternate weapon prefixes are independently normalized', () => {
  const build = replaceBuild(
    {
      alternateWeaponPrefixes: ["Viper's", 'Unknown prefix']
    },
    mesmerAppAdapter
  );

  assert.deepEqual(build.alternateWeaponPrefixes, ["Viper's", "Berserker's"]);
});

test('attribute calculation uses the prefixes selected for each weapon set', () => {
  const build = defaults();

  build.alternateWeapons = ['Dagger', 'Sword'];
  build.alternateWeaponPrefixes = ["Viper's", "Viper's"];

  const first = calculateAttributes(build, [], 1).attributes;
  const second = calculateAttributes(build, [], 2).attributes;

  assert.ok(second.Power.final < first.Power.final);
  assert.ok(second['Condition Damage'].final > first['Condition Damage'].final);
  assert.ok(second.Expertise.final > first.Expertise.final);
});

test('runtime stats follow chronological weapon-set swaps', () => {
  const build = defaults();

  build.weapons = ['Dagger', 'Sword'];
  build.alternateWeapons = ['Dagger', 'Sword'];
  build.alternateWeaponPrefixes = ["Viper's", "Viper's"];
  build.assumptions.might = 0;
  const app = {
    adapter: mesmerAppAdapter,
    attributeData: calculateAttributes(build, [], 1),
    attributeWeaponSet: 1,
    build,
    profession: mesmerProfession,
    results: null,
    skillById: mesmerProfession.catalog.skillsById,
    skillByName: mesmerProfession.catalog.skillsByName
  };
  const config = mesmerAppAdapter.simulationConfig(app);
  const query = createGw2CombatQuery({
    profession: resolveProfessionRuntime(mesmerProfession, config),
    config,
    events: [{ type: 'weapon_set', at: 1, weaponSet: 2 }]
  });

  assert.equal(query.statsAt(0.5).power, config.weaponSetStats[0].power);
  assert.equal(query.statsAt(1).power, config.weaponSetStats[1].power);
  assert.equal(query.statsAt(1).conditionDamage, config.weaponSetStats[1].conditionDamage);
  assert.equal(query.statsAt(0, null, { activeWeaponSet: 2 }).power, config.weaponSetStats[1].power);
  assert.notEqual(query.statsAt(0.5).power, query.statsAt(1).power);
});
