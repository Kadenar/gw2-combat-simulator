/** Owns utility consumable conversions, flat stats, and UI groupings. */

// Each conversion owns its percentage so calculation and labels read one complete declaration.
export const UTILITY_DATA = {
  'Leviathan Tempering Oil': [
    { to: 'Power', from: 'Power', percent: 3 },
    { to: 'Precision', from: 'Precision', percent: 3 },
    { to: 'Toughness', from: 'Toughness', percent: 3 },
    { to: 'Vitality', from: 'Vitality', percent: 3 },
    { to: 'Ferocity', from: 'Ferocity', percent: 3 },
    { to: 'Condition Damage', from: 'Condition Damage', percent: 3 },
    { to: 'Expertise', from: 'Expertise', percent: 3 },
    { to: 'Concentration', from: 'Concentration', percent: 3 },
    { to: 'Healing Power', from: 'Healing Power', percent: 3 }
  ],
  'Toxic Tuning Crystal': [
    { to: 'Condition Damage', from: 'Power', percent: 3 },
    { to: 'Condition Damage', from: 'Precision', percent: 3 }
  ],
  'Potent Lucent Oil': [
    { to: 'Concentration', from: 'Power', percent: 3 },
    { to: 'Concentration', from: 'Precision', percent: 3 }
  ],
  'Toxic Maintenance Oil': [
    { to: 'Concentration', from: 'Power', percent: 3 },
    { to: 'Concentration', from: 'Condition Damage', percent: 6 }
  ],
  'Toxic Sharpening Stone': [
    { to: 'Power', from: 'Condition Damage', percent: 6 },
    { to: 'Power', from: 'Expertise', percent: 8 }
  ],
  'Furious Sharpening Stone': [
    { to: 'Power', from: 'Precision', percent: 3 },
    { to: 'Ferocity', from: 'Precision', percent: 3 }
  ],
  'Furious Tuning Crystal': [
    { to: 'Condition Damage', from: 'Precision', percent: 3 },
    { to: 'Expertise', from: 'Precision', percent: 3 }
  ],
  'Superior Sharpening Stone': [
    { to: 'Power', from: 'Precision', percent: 3 },
    { to: 'Power', from: 'Ferocity', percent: 6 }
  ],
  'Magnanimous Tuning Crystal': [
    { to: 'Condition Damage', from: 'Vitality', percent: 3 },
    { to: 'Condition Damage', from: 'Toughness', percent: 3 }
  ],
  'Tuning Icicle': [
    { to: 'Condition Damage', from: 'Precision', percent: 3 },
    { to: 'Condition Damage', from: 'Expertise', percent: 8 }
  ],
  // This one-hour crystal converts Precision and Expertise without changing the source attribute pool.
  'Potent Master Tuning Crystal': [
    { to: 'Condition Damage', from: 'Precision', percent: 3 },
    { to: 'Condition Damage', from: 'Expertise', percent: 8 }
  ]
} satisfies Readonly<Record<string, readonly { to: string; from: string; percent: number }[]>>;

export const UTILITY_STAT_DATA = {
  'Writ of Masterful Strength': { Power: 200 },
  'Writ of Masterful Malice': { 'Condition Damage': 200 }
};

// Slaying potions assume a matching enemy and multiply strike damage without granting attributes.
export const UTILITY_STRIKE_DAMAGE_BONUSES: Readonly<Record<string, number>> = {
  'Potion of Slaying': 10
};

export const UTILITY_NAMES = [
  ...new Set([
    ...Object.keys(UTILITY_DATA),
    ...Object.keys(UTILITY_STAT_DATA),
    ...Object.keys(UTILITY_STRIKE_DAMAGE_BONUSES)
  ])
].sort((a, b) => a.localeCompare(b));

export const UTILITY_GROUPS = [
  {
    label: 'Power',
    items: [
      'Furious Sharpening Stone',
      'Potion of Slaying',
      'Superior Sharpening Stone',
      'Toxic Sharpening Stone',
      'Writ of Masterful Strength'
    ]
  },
  {
    label: 'Condition',
    items: [
      'Furious Tuning Crystal',
      'Magnanimous Tuning Crystal',
      'Potent Master Tuning Crystal',
      'Toxic Tuning Crystal',
      'Tuning Icicle',
      'Writ of Masterful Malice'
    ]
  },
  {
    label: 'Boon',
    items: ['Potent Lucent Oil', 'Toxic Maintenance Oil']
  },
  {
    label: 'All Attributes',
    items: ['Leviathan Tempering Oil']
  }
];
