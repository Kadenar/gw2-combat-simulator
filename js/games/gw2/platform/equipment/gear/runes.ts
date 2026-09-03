/** Owns rune catalog data and its UI groupings. */

// ─── Rune Data ────────────────────────────────────────────────────────────────
// stats: flat attribute bonuses (feed into conversion pool, treated as "converted")
// durations: percentage bonuses stored as numbers (e.g. 25 = 25%)
export const RUNE_DATA = {
  // ── Power ──
  Dragonhunter: { stats: { Power: 100, Ferocity: 300 }, durations: {} },
  Scholar: { stats: { Power: 175, Ferocity: 225 }, durations: {} },
  // ── Precision ──
  Deadeye: {
    stats: { Power: 175, Precision: 125, Ferocity: 100 },
    durations: {}
  },
  Infiltration: { stats: { Power: 175, Precision: 225 }, durations: {} },
  Thief: { stats: { Precision: 300, 'Condition Damage': 100 }, durations: {} },
  Eagle: { stats: { Precision: 175, Ferocity: 225 }, durations: {} },
  Golemancer: { stats: { Precision: 100, Ferocity: 300 }, durations: {} },
  // ── Condition ──
  Trapper: {
    stats: { 'Condition Damage': 300 },
    durations: { 'Condition Duration': 15 }
  },
  Krait: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Bleeding Duration': 50 }
  },
  Balthazar: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Burning Duration': 50 }
  },
  Perplexity: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Confusion Duration': 50 }
  },
  Thorns: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Poison Duration': 50 }
  },
  Afflicted: {
    stats: { 'Condition Damage': 175 },
    durations: {
      'Condition Duration': 10,
      'Bleeding Duration': 20,
      'Poison Duration': 10
    }
  },
  Tormenting: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Torment Duration': 50 }
  },
  // ── Hybrid ──
  'Flame Legion': {
    stats: { Power: 175 },
    durations: { 'Burning Duration': 50 }
  },
  Baelfire: {
    stats: { Power: 175 },
    durations: { 'Condition Duration': 10, 'Burning Duration': 30 }
  },
  'Mad King': {
    stats: { Power: 175 },
    durations: { 'Bleeding Duration': 40, 'Condition Duration': 5 }
  },
  Elementalist: {
    stats: { Power: 175, 'Condition Damage': 225 },
    durations: {}
  },
  Berserker: { stats: { Power: 100, 'Condition Damage': 300 }, durations: {} },
  Adventurer: { stats: { Power: 225, 'Condition Damage': 175 }, durations: {} },
  Renegade: {
    stats: { Ferocity: 100, 'Condition Damage': 300 },
    durations: {}
  },
  Fire: {
    stats: { Power: 175 },
    durations: { 'Burning Duration': 20, 'Might Duration': 30 }
  },
  // ── Boon Duration ──
  Firebrand: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Boon Duration': 10, 'Quickness Duration': 30 }
  },
  Fireworks: { stats: { Power: 175 }, durations: { 'Boon Duration': 25 } },
  Pack: {
    stats: { Power: 175, Precision: 125 },
    durations: { 'Boon Duration': 15 }
  },
  Strength: { stats: { Power: 175 }, durations: { 'Might Duration': 50 } },
  Aristocracy: {
    stats: { 'Condition Damage': 175 },
    durations: { 'Might Duration': 50 }
  },
  Rage: { stats: { Ferocity: 300 }, durations: { 'Fury Duration': 30 } },
  // ── All Stat ──
  Leadership: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      'Condition Damage': 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36
    },
    durations: { 'Boon Duration': 25 }
  },
  Tempest: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      'Condition Damage': 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36
    },
    durations: { 'Condition Duration': 25 }
  },
  Weaver: {
    stats: {
      Power: 36,
      Precision: 36,
      Ferocity: 36,
      Concentration: 36,
      'Condition Damage': 36,
      Expertise: 36,
      Toughness: 36,
      Vitality: 36
    },
    durations: { 'Condition Duration': 10, 'Burning Duration': 10 }
  },
  Divinity: {
    stats: {
      Power: 78,
      Precision: 78,
      Ferocity: 78,
      Concentration: 78,
      'Condition Damage': 78,
      Expertise: 78,
      Toughness: 78,
      Vitality: 78
    },
    durations: {}
  }
};

export const RUNE_NAMES = [...Object.keys(RUNE_DATA)].sort((a, b) => a.localeCompare(b));

export const RUNE_GROUPS = [
  { label: 'Power', items: ['Dragonhunter', 'Scholar'] },
  {
    label: 'Precision',
    items: ['Deadeye', 'Infiltration', 'Thief', 'Eagle', 'Golemancer']
  },
  {
    label: 'Condition',
    items: ['Trapper', 'Krait', 'Balthazar', 'Perplexity', 'Thorns', 'Afflicted', 'Tormenting']
  },
  {
    label: 'Hybrid',
    items: ['Flame Legion', 'Baelfire', 'Mad King', 'Elementalist', 'Berserker', 'Adventurer', 'Renegade', 'Fire']
  },
  {
    label: 'Boon Duration',
    items: ['Firebrand', 'Fireworks', 'Pack', 'Strength', 'Aristocracy', 'Rage']
  },
  {
    label: 'All Stats',
    items: ['Leadership', 'Tempest', 'Weaver', 'Divinity']
  }
];
