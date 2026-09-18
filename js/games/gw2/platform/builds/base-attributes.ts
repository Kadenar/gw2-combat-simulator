/** Owns the level-80 character baseline that gear and food attributes build on top of. */

// ─── Base Stats (level 80) ────────────────────────────────────────────────────
export const BASE_STATS = {
  Power: 1000,
  Precision: 1000,
  Toughness: 1000,
  Vitality: 1000
};

// ─── Jade Bot Core ────────────────────────────────────────────────────────────
// Tier 10 JBC adds Vitality. In-game this IS included in the conversion pool
// (trait conversions like Elements of Rage operate on full stats including JBC).
export const JBC_BONUS = { Vitality: 235 };
