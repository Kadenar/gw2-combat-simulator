import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { requireBalanceProfile, requireEffect } from '#gw2/platform/skills/balance-profiles.js';

/** Resolve a selected condition for runtime or preview without reconstructing an explicitly removed packet. */
export function mesmerConditionFromProfile(
  source: BalanceProfileSource,
  id: number | string,
  name: string
): ConditionEffect | undefined {
  const effect = requireEffect(requireBalanceProfile(source, id), 'condition', name);
  return effect;
}
