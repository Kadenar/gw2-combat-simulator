import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

import type { MesmerResourceDefinition } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';

/** Selects the active specialization's public resource contract at the family boundary. */
export function mesmerResourceDefinition(specialization: string, context: unknown): MesmerResourceDefinition {
  const maximum = balanceProfileNumber(
    requireBalanceProfileFromContext(context, mesmerResourceProfileId(specialization)),
    'maximumStacks'
  );
  if (specialization === 'Virtuoso') return { singular: 'blade', plural: 'blades', maximum };
  if (specialization === 'Troubadour') return { singular: 'note', plural: 'notes', maximum };
  return { singular: 'clone', plural: 'clones', maximum };
}

/** Selects the active resource balance profile without making Core own elite profile IDs. */
export function mesmerResourceProfileId(specialization: string): string {
  if (specialization === 'Virtuoso') return 'mesmer.virtuoso.resources';
  if (specialization === 'Troubadour') return 'mesmer.troubadour.resources';
  return 'mesmer.core.resources';
}

/** Selects entity ownership or the active elite clock without inspecting arbitrary state shapes. */
export function mesmerResourceKind(specialization: string): 'clones' | 'blades' | 'notes' {
  if (specialization === 'Virtuoso') return 'blades';
  if (specialization === 'Troubadour') return 'notes';
  return 'clones';
}
