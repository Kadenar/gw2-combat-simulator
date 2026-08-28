import assert from 'node:assert/strict';
import test from 'node:test';

import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '../../js/games/gw2/app/build/equipment-option-labels.js';
import { FOOD_GROUPS } from '../../js/games/gw2/platform/equipment/consumables/food.js';
import { UTILITY_GROUPS } from '../../js/games/gw2/platform/equipment/consumables/utilities.js';
import { RUNE_GROUPS } from '../../js/games/gw2/platform/equipment/gear/runes.js';
import { PREFIX_GROUPS } from '../../js/games/gw2/platform/equipment/gear/stats.js';
import { RELIC_GROUPS } from '../../js/games/gw2/platform/equipment/relics/catalog.js';
import { SIGIL_GROUPS } from '../../js/games/gw2/platform/equipment/sigils/catalog.js';

test('equipment dropdown labels expose their effects without hover text', () => {
  assert.equal(prefixOptionLabel("Berserker's"), "Berserker's — Power, Precision, Ferocity");
  assert.equal(prefixOptionLabel("Berserker's", 'Helm'), "Berserker's — +63 Power, +45 Precision, +45 Ferocity");
  assert.equal(runeOptionLabel('Scholar'), 'Scholar — +175 Power, +225 Ferocity');
  assert.equal(sigilOptionLabel('Force'), 'Force — +5% strike damage');
  assert.equal(sigilOptionLabel('Air'), 'Air — 1.1 coefficient strike on critical hit (3s CD)');
  assert.equal(
    foodOptionLabel('Bowl of Sweet and Spicy Butternut Squash Soup'),
    'Bowl of Sweet and Spicy Butternut Squash Soup — +100 Power, +70 Ferocity'
  );
  assert.equal(
    utilityOptionLabel('Superior Sharpening Stone'),
    'Superior Sharpening Stone — +3% of Precision as Power, +6% of Ferocity as Power'
  );
  assert.equal(
    relicOptionLabel('Brawler'),
    'Brawler — Grant yourself Protection or Resolution (+10% strike damage for 4s) (8s ICD)'
  );
  assert.equal(relicOptionLabel('Claw'), 'Claw — CC enemy (+7% strike damage for 8s)');
  assert.equal(
    relicOptionLabel('Peitha'),
    'Peitha — Use shadowstep or deception skill (+10% strike damage for 4s, 2 Torment for 7s) (4s ICD)'
  );
  assert.equal(relicOptionLabel('Eagle'), 'Eagle — +10% strike damage against foes below 50% health');
  assert.equal(
    relicOptionLabel('Fractal'),
    'Fractal — Apply Bleeding to a foe with 6+ Bleeding (2 Burning for 8s, 3 Torment for 8s) (20s ICD)'
  );
  assert.equal(relicOptionLabel('Thorns'), 'Thorns — Hit by a poisoned foe (+30 Condition Damage) (5s ICD)');
  assert.equal(
    relicOptionLabel('Thief'),
    'Thief — Use a weapon skill with recharge or resource cost (+1% strike damage for 6s, up to 5 stacks)'
  );
  assert.equal(
    relicOptionLabel('Aristocracy'),
    'Aristocracy — Inflict Weakness or Vulnerability (+3% condition duration per stack for 8s, up to 5 stacks) (1s ICD)'
  );
  assert.equal(
    relicOptionLabel('Steamshrieker'),
    'Steamshrieker — Combo a water field with a leap or blast finisher (1 Burning for 5s)'
  );
  assert.equal(
    relicOptionLabel('Fireworks'),
    'Fireworks — Use a weapon skill with recharge ≥20s (+7% strike damage for 7s)'
  );
  assert.equal(
    relicOptionLabel('Akeem'),
    'Akeem — CC a foe with 5+ Torment or Confusion (2 Confusion for 10s, 2 Torment for 10s) (10s ICD)'
  );
  assert.equal(
    relicOptionLabel('Blightbringer'),
    'Blightbringer — Apply Poison with six distinct skill activations (3 Poison for 10s) (8s ICD)'
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
      assert.match(label, /^.+ — .+$/, item);
      assert.doesNotMatch(label, /undefined|NaN/, item);
    }
  }
});
