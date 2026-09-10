import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';

/** Historical build bonuses subtracted during runtime reconciliation, independent of balance overrides. */
export const SOULBEAST_ARCHETYPE_ATTRIBUTES: Readonly<
  Record<string, Readonly<Partial<Record<keyof Gw2ResolvedStats, number>>>>
> = Object.freeze({
  Stout: Object.freeze({ toughness: 200, vitality: 100 }),
  Deadly: Object.freeze({ conditionDamage: 150, precision: 100 }),
  Versatile: Object.freeze({ vitality: 200, concentration: 225 }),
  Ferocious: Object.freeze({ power: 150, ferocity: 100 }),
  Supportive: Object.freeze({ vitality: 100 })
});
