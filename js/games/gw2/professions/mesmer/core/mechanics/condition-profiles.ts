import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';

/** Resolve a selected condition for runtime or preview without reconstructing an explicitly removed packet. */
export function mesmerConditionFromProfile(
  context: unknown,
  id: number | string,
  name: string
): ConditionEffect | undefined {
  const effect = requireEffect(requireBalanceProfileFromContext(context, id), 'condition', name);
  return effect;
}
