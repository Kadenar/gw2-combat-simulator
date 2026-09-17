import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCommonAttributes, PRIMARY_ATTRIBUTES } from '#gw2/platform/builds/attributes.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { weaponSkills } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// The same persistent bonus must reach both combat sets, derived stats, conversions, and modifier comparisons.
for (const adapter of [elementalistAppAdapter, engineerAppAdapter]) {
  test(`${adapter.id} preserves inactive equipment and applies max stacking sigils to both sets`, () => {
    const build = adapter.toApplicationBuild({
      ...adapter.profession.createBuildDefaults(),
      alternateWeapons: adapter.id === 'elementalist' ? ['Staff', ''] : ['Pistol', 'Shield'],
      weaponSigils: [
        ['Force', 'Accuracy'],
        ['Corruption', 'Accuracy']
      ],
      startingWeaponSet: 2
    });
    assert.equal(build.startingWeaponSet, 2);
    const bonuses = {
      Bloodlust: { Power: 250 },
      Corruption: { 'Condition Damage': 250 },
      Cruelty: { Ferocity: 250 },
      Stars: Object.fromEntries(PRIMARY_ATTRIBUTES.map((stat) => [stat, 50]))
    };
    for (const [sigil, stats] of Object.entries(bonuses)) {
      build.weaponSigils[1][0] = sigil;
      assert.deepEqual(adapter.toApplicationBuild(build).weaponSigils, build.weaponSigils);
      for (const weaponSet of [1, 2]) {
        const result = calculateCommonAttributes(build, { weaponSet });
        const removed = calculateCommonAttributes(build, { weaponSet, disabledSigil: sigil });
        for (const stat of PRIMARY_ATTRIBUTES) {
          const bonus = stats[stat] || 0;
          assert.equal(result.attributes[stat].sigils, bonus, `${sigil}: ${stat}`);
          assert.equal(removed.attributes[stat].sigils, 0);
          assert.equal(result.commonContext.conversionPool[stat] - removed.commonContext.conversionPool[stat], bonus);
        }
      }

      const app = {
        build,
        adapter,
        profession: adapter.profession,
        attributeWeaponSet: 1,
        skillByName: adapter.profession.catalog.skillsByName,
        skillById: adapter.profession.catalog.skillsById
      };
      adapter.recalculate(app);
      const without = adapter.simulationConfig(app, { type: 'Sigil', name: sigil });
      const baseline = adapter.simulationConfig(app);
      const field = { Bloodlust: 'power', Corruption: 'conditionDamage', Cruelty: 'ferocity', Stars: 'precision' }[
        sigil
      ];
      for (const set of [0, 1]) assert.ok(baseline.weaponSetStats[set][field] > without.weaponSetStats[set][field]);
    }

    const stars = calculateCommonAttributes(build);
    const removed = calculateCommonAttributes(build, { disabledSigil: 'Stars' });
    assert.ok(
      Math.abs(stars.attributes['Critical Damage'].final - removed.attributes['Critical Damage'].final - 50 / 15) < 1e-9
    );
    assert.ok(
      Math.abs(
        stars.attributes['Condition Duration'].final - removed.attributes['Condition Duration'].final - 50 / 15
      ) < 1e-9
    );
  });

  test(`${adapter.id} exposes only the starting weapon set to rotation skills`, () => {
    const build = adapter.toApplicationBuild({
      ...adapter.profession.createBuildDefaults(),
      alternateWeapons: adapter.id === 'elementalist' ? ['Staff', ''] : ['Pistol', 'Shield']
    });
    const app = {
      adapter,
      build,
      profession: adapter.profession,
      skills: adapter.profession.catalog.skills,
      skillByName: adapter.profession.catalog.skillsByName,
      skillById: adapter.profession.catalog.skillsById,
      attributeWeaponSet: 1
    };
    for (const set of [1, 2]) {
      build.startingWeaponSet = set;
      assert.deepEqual(weaponSkills(app, set === 1 ? 2 : 1), []);
      assert.ok(weaponSkills(app, set).length > 0);
    }

    adapter.recalculate(app);
    const result = simulateGw2({
      profession: adapter.profession,
      rotation:
        adapter.id === 'engineer'
          ? ['__combat_start', 'Grenade Kit', 'Swap Weapons']
          : ['__combat_start', 'Fire Attunement'],
      config: adapter.simulationConfig(app)
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.endState.activeWeaponSet, 2);
    assert.equal(
      result.events.some((event) => event.type === 'weapon_set'),
      false
    );
  });
}

test('stacking sigils require an equipped socket and only the first stacking type contributes', () => {
  const build = elementalistAppAdapter.toApplicationBuild(elementalistAppAdapter.profession.createBuildDefaults());
  build.weaponSigils = [
    ['Force', 'Accuracy'],
    ['Bloodlust', 'Cruelty']
  ];
  assert.equal(calculateCommonAttributes(build).attributes.Power.sigils, 0);
  build.alternateWeapons = ['Staff', ''];
  let result = calculateCommonAttributes(build);
  assert.equal(result.attributes.Power.sigils, 250);
  assert.equal(result.attributes.Ferocity.sigils, 0);
  build.weaponSigils[0][0] = 'Bloodlust';
  assert.equal(calculateCommonAttributes(build).attributes.Power.sigils, 250);
  build.weaponSigils = [
    ['Force', 'Accuracy'],
    ['Force', 'Cruelty']
  ];
  assert.equal(calculateCommonAttributes(build).attributes.Ferocity.sigils, 250);
  build.alternateWeapons = ['Scepter', ''];
  result = calculateCommonAttributes(build);
  assert.equal(result.attributes.Ferocity.sigils, 0);
});
