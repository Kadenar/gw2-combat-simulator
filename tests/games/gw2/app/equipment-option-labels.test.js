import assert from 'node:assert/strict';
import test from 'node:test';

import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '#gw2/app/shared/equipment/labels.js';
import { FOOD_GROUPS } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_GROUPS } from '#gw2/platform/equipment/consumables/utilities.js';
import { PREFIX_GROUPS, PREFIXES } from '#gw2/platform/equipment/gear/prefixes/catalog.js';
import { RUNE_GROUPS } from '#gw2/platform/equipment/gear/runes.js';
import { RELIC_GROUPS } from '#gw2/platform/equipment/relics/catalog.js';
import { SIGIL_GROUPS, SIGIL_NAMES } from '#gw2/platform/equipment/sigils/catalog.js';

test('equipment dropdown labels expose their effects without hover text', () => {
  assert.equal(prefixOptionLabel("Berserker's"), "Berserker's - Power, Precision, Ferocity");
  assert.equal(prefixOptionLabel("Berserker's", 'Helm'), "Berserker's - +63 Power, +45 Precision, +45 Ferocity");
  assert.equal(runeOptionLabel('Scholar'), 'Scholar - +175 Power, +225 Ferocity');
  assert.equal(sigilOptionLabel('Force'), 'Force - +5% strike damage');
  assert.equal(sigilOptionLabel('Strength'), 'Strength - Might for 10s on critical hit (1s CD)');
  assert.equal(sigilOptionLabel('Air'), 'Air - 1.1 coefficient strike on critical hit (3s CD)');
  assert.equal(
    foodOptionLabel('Bowl of Sweet and Spicy Butternut Squash Soup'),
    'Bowl of Sweet and Spicy Butternut Squash Soup - +100 Power, +70 Ferocity'
  );
  assert.equal(
    utilityOptionLabel('Superior Sharpening Stone'),
    'Superior Sharpening Stone - +3% of Precision as Power, +6% of Ferocity as Power'
  );
  assert.equal(
    relicOptionLabel('Brawler'),
    'Brawler - Granting yourself Protection or Resolution grants 10% more strike damage for 4s. (8s ICD)'
  );
  assert.equal(relicOptionLabel('Claw'), 'Claw - Disabling an enemy grants 7% more strike damage for 8s.');
  assert.equal(
    relicOptionLabel('Peitha'),
    'Peitha - Using a shadowstep or deception skill grants 10% more strike damage for 4s and applies 2 stacks of Torment for 7s. (4s ICD)'
  );
  assert.equal(relicOptionLabel('Eagle'), 'Eagle - Deal 10% more strike damage to foes below 50% health.');
  assert.equal(
    relicOptionLabel('Fractal'),
    'Fractal - Applying Bleeding to a foe with at least 6 stacks of Bleeding also applies 2 stacks of Burning and 3 stacks of Torment for 8s. (20s ICD)'
  );
  assert.equal(relicOptionLabel('Thorns'), 'Thorns - Being hit by a poisoned foe grants 30 Condition Damage. (5s ICD)');
  assert.equal(
    relicOptionLabel('Thief'),
    'Thief - Using a weapon skill with a recharge or resource cost grants 1% more strike damage for 6s, up to 5 stacks.'
  );
  assert.equal(
    relicOptionLabel('Aristocracy'),
    'Aristocracy - Inflicting Weakness or Vulnerability grants 3% condition duration for 8s, up to 5 stacks. (1s ICD)'
  );
  assert.equal(
    relicOptionLabel('Steamshrieker'),
    'Steamshrieker - Completing a leap or blast finisher in a water field applies 1 stack of Burning for 5s.'
  );
  assert.equal(
    relicOptionLabel('Fireworks'),
    'Fireworks - Dealing strike damage with a skill whose recharge is at least 20s grants 7% more strike damage for 6s.'
  );
  assert.equal(
    relicOptionLabel('Akeem'),
    'Akeem - Disabling a foe with at least 5 stacks of Torment or Confusion applies 2 stacks each of Confusion and Torment for 10s. (10s ICD)'
  );
  assert.equal(
    relicOptionLabel('Last Tyrant'),
    "Last Tyrant - Inflicting Burning at 5 Tyrant's Fury stacks triggers an explosion and applies 2 stacks of Burning for 8s. The explosion uses a placeholder damage coefficient of 3.0. (12s ICD)"
  );
  assert.equal(
    relicOptionLabel('Visionary'),
    'Visionary - Completing 8 combos grants 10% more strike and condition damage for 8s. Whirl finishers count once every 3s.'
  );
  assert.equal(
    relicOptionLabel('Blightbringer'),
    'Blightbringer - Applying Poison through six separate skill activations applies 3 extra stacks of Poison for 10s. (8s ICD)'
  );
});

test('every selectable equipment option has visible effect details', () => {
  const catalogs = [
    [PREFIX_GROUPS, prefixOptionLabel],
    [RUNE_GROUPS, runeOptionLabel],
    [SIGIL_GROUPS, sigilOptionLabel],
    [RELIC_GROUPS, relicOptionLabel],
    [FOOD_GROUPS, foodOptionLabel],
    [UTILITY_GROUPS, utilityOptionLabel]
  ];

  for (const [groups, labelFor] of catalogs) {
    for (const item of groups.flatMap((group) => group.items)) {
      const label = labelFor(item);
      assert.match(label, /^.+ - .+$/, item);
      assert.doesNotMatch(label, /undefined|NaN/, item);
    }
  }
});

test('gear prefixes and sigils are sorted into Power and Condition groups', () => {
  // Prefixes without Condition Damage belong to Power, including defensive and support stat combinations.
  assert.deepEqual(PREFIX_GROUPS, [
    {
      label: 'Power',
      items: [
        "Assassin's",
        "Berserker's",
        "Demolisher's",
        "Diviner's",
        "Dragon's",
        "Harrier's",
        "Knight's",
        'Marauder',
        'Valkyrie',
        "Zealot's"
      ]
    },
    {
      label: 'Condition',
      items: [
        'Celestial',
        'Dire',
        'Grieving',
        "Plaguedoctor's",
        'Rabid',
        "Rampager's",
        "Ritualist's",
        'Sinister',
        "Trailblazer's",
        "Viper's"
      ]
    }
  ]);
  // Keep selectable sigils alphabetized within their intended damage groups.
  assert.deepEqual(SIGIL_GROUPS, [
    {
      label: 'Power',
      items: [
        'Accuracy',
        'Air',
        'Bloodlust',
        'Concentration',
        'Cruelty',
        'Energy',
        'Force',
        'Hydromancy',
        'Impact',
        'Mischief',
        'Night',
        'Severance',
        'Slaying',
        'Stars',
        'Strength'
      ]
    },
    {
      label: 'Condition',
      items: [
        'Agony',
        'Blight',
        'Bursting',
        'Corruption',
        'Demons',
        'Doom',
        'Earth',
        'Frailty',
        'Geomancy',
        'Ice',
        'Malice',
        'Smoldering',
        'Torment',
        'Venom'
      ]
    }
  ]);
  assert.deepEqual(PREFIX_GROUPS.flatMap((group) => group.items).sort(), PREFIXES);
  assert.deepEqual(SIGIL_GROUPS.flatMap((group) => group.items).sort(), SIGIL_NAMES);
});
