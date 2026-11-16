// Percentage food must preserve conversion eligibility, source attribution, and build/combat agreement.
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAttributeContributions, resolveAttributeContributions } from '#gw2/platform/attributes/evaluation.js';
import {
  ATTRIBUTE_NAMES,
  equipmentAttributeConversions,
  validateAttributeInputs
} from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { FOOD_GROUPS } from '#gw2/platform/equipment/consumables/food.js';
import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';

const food = 'Bag of Popped Candy Corn';

test('Popped Candy Corn scales all nine attributes from eligible inputs without chaining conversions', () => {
  assert.ok(FOOD_GROUPS.find((group) => group.label === 'All Stats').items.includes(food));
  const pool = Object.freeze({
    Power: 2000,
    Precision: 1600,
    Toughness: 1000,
    Vitality: 1235,
    Ferocity: 500,
    'Condition Damage': 1500,
    Expertise: 700,
    Concentration: 400,
    'Healing Power': 200
  });
  const resolved = resolveAttributeContributions(
    { conversionPool: pool, conversions: equipmentAttributeConversions('Superior Sharpening Stone', food) },
    [
      {
        attributeEffects: [
          { kind: 'flat', to: 'Precision', amount: 200, feedsConversions: 'all' },
          { kind: 'flat', to: 'Precision', amount: 100, feedsConversions: 'profession-only' },
          { kind: 'flat', to: 'Precision', amount: 100, feedsConversions: 'none' },
          { kind: 'conversion', from: 'Precision', to: 'Power', multiplier: 0.1, rounding: 'round', input: 'eligible' }
        ]
      }
    ]
  );
  assert.deepEqual(resolved.foodAttributes, {
    Power: 60,
    Precision: 54,
    Toughness: 30,
    Vitality: 37,
    Ferocity: 15,
    'Condition Damage': 45,
    Expertise: 21,
    Concentration: 12,
    'Healing Power': 6
  });
  assert.equal(resolved.attributes.Power, 190);
  assert.deepEqual(resolved.utilityAttributes, { Power: 84 });
  assert.equal(pool.Precision, 1600);
});

test('food, oil, and reinforcement share rounding without multiplying one another', () => {
  const seed = {
    conversionPool: { Vitality: 1044 },
    conversions: equipmentAttributeConversions('Leviathan Tempering Oil', food)
  };
  for (const conversions of [seed.conversions, [...seed.conversions].reverse()]) {
    const inputs = { ...seed, conversions };
    const resolved = resolveAttributeContributions(inputs, []);
    assert.equal(resolved.foodAttributes.Vitality, 31);
    assert.equal(resolved.utilityAttributes.Vitality, 32);
    assert.equal(resolved.reinforcedArmorAttributes.Vitality, 52);
    assert.equal(applyAttributeContributions(inputs, { vitality: 1044 }, []).vitality, 1159);
  }
});

test('percentage food survives serialization and agrees between build and combat on both weapon sets', () => {
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(warriorCatalog),
    warriorProfession.attributeContributions
  );
  const build = createWarriorBuildDefaults();
  build.assumptions = {};
  build.specializations = [{ name: 'Arms', traits: '2-3-1' }];
  build.weapons = ['Longbow', ''];
  build.alternateWeapons = ['Sword', 'Sword'];
  build.alternateWeaponPrefixes = ['Celestial', 'Celestial'];
  build.food = food;
  build.utility = 'Leviathan Tempering Oil';
  const panels = [1, 2].map((set) => calculate(build, [], set));
  const attributeInputs = JSON.parse(JSON.stringify({ weaponSets: panels.map((panel) => panel.attributeSeed) }));
  assert.doesNotThrow(() => validateAttributeInputs(attributeInputs));
  const config = {
    specialization: 'Core',
    selectedTraitIds: panels[0].activeTraits.map((trait) => trait.id),
    selectedSkillIds: [],
    primaryWeapon: 'Longbow',
    weaponSet2Primary: 'Sword',
    weaponSet2Secondary: 'Sword',
    startingWeaponSet: 1,
    attributeInputs,
    boons: {}
  };
  const query = createGw2CombatQuery({ config, profession: warriorProfession.runtimeFor(config) });
  for (const [index, panel] of panels.entries()) {
    const stats = query.statsAt(0, null, { activeWeaponSet: index + 1 });
    // Blademaster's permanent 120 Expertise must feed food even with the longbow equipped.
    assert.equal(
      panel.attributes.Expertise.food,
      Math.round((panel.attributeSeed.conversionPool.Expertise + 120) * 0.03)
    );
    for (const [key, name] of Object.entries(ATTRIBUTE_NAMES)) {
      const { final, ...sources } = panel.attributes[name];
      assert.equal(
        final,
        Object.values(sources).reduce((sum, value) => sum + value, 0),
        name
      );
      assert.equal(stats[key], final, `${name}, weapon set ${index + 1}`);
    }

    assert.equal(panel.attributes['Condition Duration'].final, panel.attributes.Expertise.final / 15);
    assert.equal(panel.attributes['Boon Duration'].final, panel.attributes.Concentration.final / 15);
  }
});
