import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

/** Resolve a selected condition for runtime or preview without reconstructing an explicitly removed packet. */
export function mesmerConditionFromProfile(
  context: unknown,
  id: number | string,
  name: string
): MesmerConditionApplication | undefined {
  const effect = requireEffect(requireBalanceProfileFromContext(context, id), 'condition', name);
  return effect ? { ...effect, summonKind: undefined, name: effect.condition! } : undefined;
}
