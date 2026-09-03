/** Owns utility consumable conversions, flat stats, and UI groupings. */

// ─── Utility Conversions ─────────────────────────────────────────────────────
// Percentage of the source stat (from conversion base pool) added to target stat.
// Rates come from Utility_conversions.csv.
export const UTILITY_CONVERSION_RATES = {
  Power: 3,
  Precision: 3,
  Toughness: 3,
  Vitality: 3,
  'Condition Damage': 6,
  Ferocity: 6,
  'Healing Power': 6,
  Concentration: 8,
  Expertise: 8
};

// UTILITY_DATA[name] → array of { to, from } conversion pairs
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
    { to: 'Condition Damage', from: 'Power' },
    { to: 'Condition Damage', from: 'Precision' }
  ],
  'Potent Lucent Oil': [
    { to: 'Concentration', from: 'Power' },
    { to: 'Concentration', from: 'Precision' }
  ],
  'Toxic Maintenance Oil': [
    { to: 'Concentration', from: 'Power' },
    { to: 'Concentration', from: 'Condition Damage' }
  ],
  'Toxic Sharpening Stone': [
    { to: 'Power', from: 'Condition Damage' },
    { to: 'Power', from: 'Expertise' }
  ],
  'Furious Sharpening Stone': [
    { to: 'Power', from: 'Precision' },
    { to: 'Ferocity', from: 'Precision' }
  ],
  'Furious Tuning Crystal': [
    { to: 'Condition Damage', from: 'Precision' },
    { to: 'Expertise', from: 'Precision' }
  ],
  'Superior Sharpening Stone': [
    { to: 'Power', from: 'Precision' },
    { to: 'Power', from: 'Ferocity' }
  ],
  'Magnanimous Tuning Crystal': [
    { to: 'Condition Damage', from: 'Vitality' },
    { to: 'Condition Damage', from: 'Toughness' }
  ],
  'Tuning Icicle': [
    { to: 'Condition Damage', from: 'Precision' },
    { to: 'Condition Damage', from: 'Expertise' }
  ]
};

export const UTILITY_STAT_DATA = {
  'Writ of Masterful Strength': { Power: 200 },
  'Writ of Masterful Malice': { 'Condition Damage': 200 }
};

export const UTILITY_NAMES = [...new Set([...Object.keys(UTILITY_DATA), ...Object.keys(UTILITY_STAT_DATA)])].sort(
  (a, b) => a.localeCompare(b)
);

export const UTILITY_GROUPS = [
  {
    label: 'Power',
    items: [
      'Furious Sharpening Stone',
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
