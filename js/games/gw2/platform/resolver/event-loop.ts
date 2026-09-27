import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

export const GW2_RESOLVER_PHASE = Object.freeze({ Sample: 0, Settle: 1, Ordinary: 2 });

/** Settlement reactions expose state before strikes, while direct attacks and future work retain their own phase. */
export function gw2ResolverPhase(
  event: Gw2ResolverEvent,
  current: Readonly<{ at: number; phase: number }> | null
): number {
  if (event.type === 'condition_buffer') return GW2_RESOLVER_PHASE.Sample;
  if (event.type === 'condition_tick') return GW2_RESOLVER_PHASE.Settle;
  if (event.type !== 'damage' && current?.at === event.at && current.phase === GW2_RESOLVER_PHASE.Settle) {
    return GW2_RESOLVER_PHASE.Settle;
  }

  return GW2_RESOLVER_PHASE.Ordinary;
}
