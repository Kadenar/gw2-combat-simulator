import type { ProfessionModifierDefinition } from '#gw2/platform/profession-definition/types.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';

// Illusion strikes share profession additions but do not inherit the player's additive sigil bonuses.
export const mesmerCoreModifiers = Object.freeze({
  damageBuckets: {
    strikeDamage: {
      includeSigil: (context) => !illusionSource(context)
    }
  }
} satisfies ProfessionModifierDefinition);
