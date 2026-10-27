import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';

import type { MesmerResourceDefinition } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';

/** Selects the active specialization's public resource contract at the family boundary. */
export function mesmerResourceDefinition(specialization: string, context: unknown): MesmerResourceDefinition {
  if (specialization === 'Virtuoso')
    return {
      singular: 'blade',
      plural: 'blades',
      maximum: balanceNumberFromContext(context, TRAIT.PSYCHIC_BLADES, 'maximumStacks')
    };

  if (specialization === 'Troubadour')
    return {
      singular: 'note',
      plural: 'notes',
      maximum: balanceNumberFromContext(context, TRAIT.WANDERING_MINSTREL, 'maximumStacks')
    };

  // Clone capacity is a fixed entity limit; elite replacement resources retain their trait-owned tuning.
  return { singular: 'clone', plural: 'clones', maximum: 3 };
}

/** Selects entity ownership or the active elite clock without inspecting arbitrary state shapes. */
export function mesmerResourceKind(specialization: string): 'clones' | 'blades' | 'notes' {
  if (specialization === 'Virtuoso') return 'blades';

  if (specialization === 'Troubadour') return 'notes';

  return 'clones';
}
