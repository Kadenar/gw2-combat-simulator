import { isStandardBoon } from '../combat/state/boons.js';
import { gw2BoonDurationMultiplier, gw2SigilSet } from '../combat/query/runtime-rules.js';

import type { Gw2ResolverEvent, Gw2ResolverRuntime } from './types.js';

/** Applies live resolver stats and active sigils to a newly generated standard boon. */
export function gw2ResolverBoonDuration(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  boon: string,
  baseDuration: number,
  { fixedDuration = false }: { readonly fixedDuration?: boolean } = {}
): number {
  // Resolver reactions sample at the triggering event time so weapon swaps and
  // profession attribute changes affect the new application deterministically.
  if (fixedDuration || !isStandardBoon(boon)) return baseDuration;
  const weaponSet = context.activeWeaponSet === 2 ? 2 : 1;
  const stats = context.query.statsAt(
    event.at,
    {
      ...event,
      type: 'buff',
      actorType: 'player',
      kind: boon
    },
    context
  );
  return baseDuration * gw2BoonDurationMultiplier(boon, stats, gw2SigilSet(context.config, weaponSet));
}
