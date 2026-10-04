import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

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

interface MesmerNumericResourceState {
  numericResource: number;
}

/** Returns the active numeric resource state and rejects clone-owning Mesmer specializations. */
export function mesmerNumericResourceState(state: MesmerRuntime): MesmerNumericResourceState {
  const kind = state.profession.specialization.kind;
  const active = readProfessionSpecializationState<MesmerNumericResourceState>(state.profession, kind);
  if (typeof active?.numericResource !== 'number') {
    throw new TypeError(`${kind} does not own a numeric Mesmer resource.`);
  }

  return active as MesmerNumericResourceState;
}
