export const GW2_RESOLVER_PHASE = Object.freeze({ Sample: 0, Settle: 1, Buffs: 2, Ordinary: 3 });

/** Settlement reactions expose state before strikes, while direct attacks and future work retain their own phase. */
export function gw2ResolverPhase(
  event: Readonly<{ type: string; at: number }>,
  current: Readonly<{ at: number; phase: number }> | null
): number {
  if (event.type === 'condition_buffer') return GW2_RESOLVER_PHASE.Sample;

  if (event.type === 'condition_tick') return GW2_RESOLVER_PHASE.Settle;

  // Zero-duration grants armed during settlement retire only after ordinary gameplay has finished.
  if (event.type === 'runtime.flip-expiry') return GW2_RESOLVER_PHASE.Ordinary;

  // Reactions inherit their cause's phase, so buffs created by damage cannot precede that damage.
  if (event.type !== 'damage' && current?.at === event.at && current.phase === GW2_RESOLVER_PHASE.Settle) {
    return current.phase;
  }

  // Independent grants and explicitly scheduled grant tasks precede strikes; reactions cannot rewind their cause.
  if (
    event.type === 'buff' ||
    event.type === 'boon_extension' ||
    ((event.type === 'runtime.task' || event.type === 'runtime.cast-task') &&
      'timing' in event &&
      event.timing === 'buffs')
  ) {
    return current?.at === event.at ? Math.max(current.phase, GW2_RESOLVER_PHASE.Buffs) : GW2_RESOLVER_PHASE.Buffs;
  }

  return GW2_RESOLVER_PHASE.Ordinary;
}
