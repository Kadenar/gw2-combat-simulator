import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/types.js';

/** Decodes the trait-dependent window once for independent scheduler and resolver state transitions. */
export function lethalTempoParameters(context: unknown) {
  const tyrantsMomentum = hasTrait(context, TRAIT.TYRANTS_MOMENTUM);
  const lethalTempo = balanceProfileFromContext(context, PROFILE.lethalTempo);
  const durationProfile = tyrantsMomentum ? balanceProfileFromContext(context, PROFILE.tyrantsMomentum) : lethalTempo;
  return {
    maximumStacks: Number(lethalTempo?.maximumStacks ?? 5),
    duration: Number(balanceProfileEffect(durationProfile, 'buff')?.duration ?? (tyrantsMomentum ? 4 : 6))
  };
}

export function gainLethalTempo(
  state: GuardianWillbenderState,
  at: number,
  { maximumStacks, duration }: ReturnType<typeof lethalTempoParameters>
): number {
  // Stacks must reset when the previous window has fully expired before adding the new one;
  // otherwise a new activation mid-window would compound on a stale count.
  if (at >= state.lethalTempoUntil) state.lethalTempoStacks = 0;
  state.lethalTempoStacks = Math.min(maximumStacks, state.lethalTempoStacks + 1);
  state.lethalTempoUntil = at + duration;
  return state.lethalTempoStacks;
}

export function activeLethalTempo(state: GuardianWillbenderState, at: number): number {
  return at < state.lethalTempoUntil ? state.lethalTempoStacks : 0;
}
