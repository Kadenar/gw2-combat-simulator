import { createDefaultBuild, replaceBuild } from '#gw2/app/build/state/persistence.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createGw2CombatQuery, gw2StatsForWeaponSet } from '#gw2/platform/combat/query/combat-query.js';
import { resolveProfessionContract } from '#gw2/platform/profession-definition/compiler/compile-contract.js';
import { PREFIXES } from '#gw2/platform/equipment/gear/prefixes/catalog.js';
import { GEAR_STATS } from '#gw2/platform/equipment/gear/prefixes/data.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { applyMesmerBuildAttributeRules } from '#gw2/professions/mesmer/build/attributes.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Attribute assertions use the same calculator composed into the Mesmer adapter.
const calculateAttributes = createCalculateAttributes(
  applyMesmerBuildAttributeRules,
  mesmerProfession.traitBuildAttributes
);
const defaults = () => createDefaultBuild(mesmerAppAdapter);

test('new prefixes load in every gear slot and use ascended attribute budgets', () => {
  // Each new stat combination must survive loading on both weapon sets and retain every slot's budget.
  for (const [prefix, reference, attributes] of [
    [
      'Marauder',
      "Diviner's",
      { Power: 'Power', Precision: 'Concentration', Vitality: 'Precision', Ferocity: 'Ferocity' }
    ],
    [
      "Demolisher's",
      "Diviner's",
      { Power: 'Power', Precision: 'Concentration', Toughness: 'Precision', Ferocity: 'Ferocity' }
    ],
    ["Knight's", "Berserker's", { Toughness: 'Power', Power: 'Precision', Precision: 'Ferocity' }],
    ["Harrier's", "Berserker's", { Power: 'Power', 'Healing Power': 'Precision', Concentration: 'Ferocity' }]
  ]) {
    assert.ok(PREFIXES.includes(prefix));
    const build = defaults();
    for (const slot of Object.keys(build.gear)) build.gear[slot] = prefix;
    build.alternateWeaponPrefixes = [prefix, prefix];
    const loaded = replaceBuild(build, mesmerAppAdapter);
    assert.deepEqual(loaded.gear, build.gear);
    assert.deepEqual(loaded.alternateWeaponPrefixes, [prefix, prefix]);
    assert.equal(mesmerProfession.validateBuild(loaded).valid, true);
    for (const [slot, stats] of Object.entries(GEAR_STATS[reference])) {
      assert.deepEqual(
        GEAR_STATS[prefix][slot],
        Object.fromEntries(Object.entries(attributes).map(([attribute, source]) => [attribute, stats[source]]))
      );
    }
  }
});

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

test('weapon-set overrides preserve base stats and explicit zero values', () => {
  // Partial sets inherit unspecified stats, including when a caller starts on set two.
  const config = {
    stats: { power: 2000, expertise: 150 },
    weaponSetStats: [{ power: 0 }, { expertise: 300 }],
    startingWeaponSet: 2
  };
  assert.deepEqual(gw2StatsForWeaponSet(config, 1), { power: 0, expertise: 150 });
  assert.deepEqual(gw2StatsForWeaponSet(config), { power: 2000, expertise: 300 });
  assert.deepEqual(gw2StatsForWeaponSet({ stats: config.stats }), config.stats);
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
    profession: resolveProfessionContract(mesmerProfession, config),
    config,
    events: [{ type: 'weapon_set', at: 1, weaponSet: 2 }]
  });

  assert.equal(query.statsAt(0.5).power, config.weaponSetStats[0].power);
  assert.equal(query.statsAt(1).power, config.weaponSetStats[1].power);
  assert.equal(query.statsAt(1).conditionDamage, config.weaponSetStats[1].conditionDamage);
  assert.equal(query.statsAt(0, null, { activeWeaponSet: 2 }).power, config.weaponSetStats[1].power);
  assert.notEqual(query.statsAt(0.5).power, query.statsAt(1).power);
});
