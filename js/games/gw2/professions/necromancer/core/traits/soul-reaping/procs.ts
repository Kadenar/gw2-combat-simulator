import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Share Dhuumfire projection with tooltips and apply shroud attack procs without importing shroud mechanics. */

/** Mechanic metadata overrides skill duration, then trait tuning; Core needs no specialization knowledge. */
export function dhuumfireProjection(
  context: unknown,
  source: { readonly dhuumfireDuration?: unknown; readonly dhuumfireInterval?: number } = {},
  skillDuration?: unknown
) {
  const profile = requireBalanceProfileFromContext(context, TRAIT.DHUUMFIRE);
  const burning = requireEffect(profile, 'condition', 'Burning');
  const duration = source.dhuumfireDuration ?? skillDuration;
  return {
    interval: source.dhuumfireInterval ?? 0,
    effect: burning
      ? {
          type: 'condition' as const,
          name: burning.name,
          condition: String(burning.condition),
          stacks: effectNumber(profile, burning, 'stacks'),
          duration: duration == null ? effectNumber(profile, burning, 'duration') : Number(duration)
        }
      : undefined
  };
}
