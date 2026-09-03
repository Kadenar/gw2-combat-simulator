/** Owns food catalog data, proc metadata, and UI groupings. */

// ─── Food Data ────────────────────────────────────────────────────────────────
// isConverted: true  → stats feed into the conversion pool (subject to utility/trait conversions)
// isConverted: false → stats applied after conversions as flat buffs
// durations: percentage bonuses stored as numbers
export const NOURISHMENT_ICON = 'https://wiki.guildwars2.com/images/c/ca/Nourishment_food.png';

const FOOD_CATALOG = {
  Power: {
    'Plate of Jerk Poultry': {
      isConverted: true,
      stats: { Power: 150 },
      durations: {}
    },
    'Plate of Truffle Steak': {
      isConverted: true,
      stats: { Power: 100, Precision: 70 },
      durations: {}
    },
    'Bowl of Sweet and Spicy Butternut Squash Soup': {
      isConverted: true,
      stats: { Power: 100, Ferocity: 70 },
      durations: {}
    },
    'Bowl of Sawgill Mushroom Risotto': {
      isConverted: true,
      stats: { Precision: 150 },
      durations: {}
    },
    'Bowl of Curry Butternut Squash Soup': {
      isConverted: true,
      stats: { Ferocity: 70, Precision: 100 },
      durations: {}
    },
    'Plate of Coq Au Vin with Salsa': {
      isConverted: true,
      stats: { Power: 100, Precision: 70 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    },
    'Cilantro Lime Sous-Vide Steak': {
      isConverted: true,
      stats: { Power: 100, Ferocity: 70 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    }
  },
  Condition: {
    'Ghost Pepper Popper': {
      icon: 'https://render.guildwars2.com/file/1C1D9D0407CD96F3E80266DEBD2B544E799AF658/433666.png',
      isConverted: true,
      stats: {},
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.4,
        icdMs: 1000,
        name: 'Ghost Pepper Popper',
        dayEffect: {
          type: 'boon',
          name: 'Might',
          stacks: 1,
          duration: 5
        },
        nightEffect: {
          type: 'condition',
          name: 'Chilled',
          stacks: 1,
          duration: 1
        }
      }
    },
    'Plate of Beef Rendang': {
      isConverted: true,
      stats: { 'Condition Damage': 100, Expertise: 70 },
      durations: {}
    },
    'Rare Veggie Pizza': {
      isConverted: true,
      stats: { 'Condition Damage': 70, Expertise: 100 },
      durations: {}
    },
    'Fishy Rice Bowl': {
      isConverted: true,
      stats: { 'Condition Damage': 70 },
      durations: { 'Burning Duration': 15 }
    },
    'Bowl of Kimchi Tofu Stew': {
      isConverted: true,
      stats: { 'Condition Damage': 70 },
      durations: { 'Poison Duration': 15 }
    },
    'Meaty Asparagus Skewer': {
      isConverted: true,
      stats: { 'Condition Damage': 70 },
      durations: { 'Torment Duration': 15 }
    },
    'Meaty Rice Bowl': {
      isConverted: true,
      stats: { 'Condition Damage': 70 },
      durations: { 'Bleeding Duration': 15 }
    },
    'Plate of Kimchi Pancakes': {
      isConverted: true,
      stats: { 'Condition Damage': 70 },
      durations: { 'Bleeding Duration': 15 }
    },
    'Cilantro and Cured Meat Flatbread': {
      isConverted: true,
      stats: { 'Condition Damage': 100, Expertise: 70 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    },
    'Salsa-Topped Veggie Flatbread': {
      isConverted: true,
      stats: { 'Condition Damage': 70, Expertise: 100 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    }
  },
  Hybrid: {
    'Plate of Fire Flank Steak': {
      isConverted: true,
      stats: { Power: 100, 'Condition Damage': 70 },
      durations: {}
    },
    'Bowl of Fancy Potato and Leek Soup': {
      isConverted: true,
      stats: { Precision: 100, 'Condition Damage': 70 },
      durations: {}
    },
    'Bowl of Truffle Risotto': {
      isConverted: true,
      stats: { Precision: 70, 'Condition Damage': 100 },
      durations: {}
    },
    'Bowl of Sweet and Spicy Beans': {
      isConverted: true,
      stats: { Power: 70, 'Condition Damage': 100 },
      durations: {}
    },
    'Bowl of Fire Meat Chili': {
      isConverted: true,
      stats: { Precision: 70 },
      durations: { 'Burning Duration': 15 }
    }
  },
  Concentration: {
    'Soul Pastry': {
      isConverted: true,
      stats: { Power: 70, Concentration: 100 },
      durations: {}
    },
    'Plate of Eggs Benedict': {
      isConverted: true,
      stats: { Expertise: 70, Concentration: 100 },
      durations: {}
    },
    'Plate of Beef Carpaccio with Salsa Garnish': {
      isConverted: true,
      stats: { Power: 70, Concentration: 100 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    },
    'Salsa Eggs Benedict': {
      isConverted: true,
      stats: { Expertise: 70, Concentration: 100 },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    }
  },
  'All Stats': {
    "Dragon's Revelry Starcake": {
      isConverted: false,
      stats: {
        Power: 45,
        Ferocity: 45,
        Precision: 45,
        'Condition Damage': 45,
        Expertise: 45,
        Vitality: 45,
        Toughness: 45,
        Concentration: 45
      },
      durations: {}
    },
    'Spherified Cilantro Oyster Soup': {
      isConverted: true,
      stats: {
        Power: 45,
        Ferocity: 45,
        Precision: 45,
        'Condition Damage': 45,
        Expertise: 45,
        Vitality: 45,
        Toughness: 45,
        Concentration: 45
      },
      durations: {},
      proc: {
        type: 'critStrike',
        chance: 0.66,
        icdMs: 2000,
        flatDamage: 325,
        name: 'Nourishment'
      }
    }
  }
};

export const FOOD_DATA = Object.fromEntries(Object.values(FOOD_CATALOG).flatMap((foods) => Object.entries(foods)));

export const FOOD_NAMES = [...Object.keys(FOOD_DATA)].sort((a, b) => a.localeCompare(b));

export const FOOD_GROUPS = Object.entries(FOOD_CATALOG).map(([label, foods]) => ({
  label,
  items: Object.keys(foods)
}));
