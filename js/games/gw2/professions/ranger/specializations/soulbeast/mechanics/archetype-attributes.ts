import type { Gw2NumericStatKey } from '#gw2/platform/attributes/stats.js';

// Archetype bonuses are fixed merge rules shared by preview and combat.
const ARCHETYPE_ATTRIBUTES: Readonly<Record<string, Readonly<Partial<Record<Gw2NumericStatKey, number>>>>> =
  Object.freeze({
    Stout: Object.freeze({ toughness: 200, vitality: 100 }),
    Deadly: Object.freeze({ conditionDamage: 150, precision: 100 }),
    Versatile: Object.freeze({ vitality: 200, concentration: 225 }),
    Ferocious: Object.freeze({ power: 150, ferocity: 100 }),
    Supportive: Object.freeze({ vitality: 100 })
  });

/** The active pet selects its fixed bonus; an unknown archetype supplies no attributes. */
export function soulbeastArchetypeAttributes(archetype: string): Readonly<Partial<Record<Gw2NumericStatKey, number>>> {
  return Object.hasOwn(ARCHETYPE_ATTRIBUTES, archetype) ? ARCHETYPE_ATTRIBUTES[archetype] : {};
}
