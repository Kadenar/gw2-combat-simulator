import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

/** Resolve a named condition without reconstructing an explicitly removed packet. */
export function mesmerConditionFromProfile(
  context: MesmerRuntime,
  id: number | string,
  name: string
): MesmerConditionApplication | undefined {
  const effect = requireEffect(requireBalanceProfileFromContext(context, id), 'condition', name);
  return effect ? { ...effect, summonKind: undefined, name: effect.condition! } : undefined;
}
