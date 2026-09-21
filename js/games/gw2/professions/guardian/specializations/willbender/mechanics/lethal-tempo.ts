/** Shares Lethal Tempo's stack and expiry rules while scheduler and resolver retain independent state. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

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
  // Grants through the expiry tick refresh every stack; only a later grant starts a new stack window.
  at = canonicalTime(at);
  if (state.lethalTempoUntil <= 0 || at > state.lethalTempoUntil) state.lethalTempoStacks = 0;
  state.lethalTempoStacks = Math.min(maximumStacks, state.lethalTempoStacks + 1);
  state.lethalTempoUntil = gw2EffectExpiresAt(at, duration);
  return state.lethalTempoStacks;
}

export function activeLethalTempo(state: GuardianWillbenderState, at: number): number {
  // Damage on the final effect tick still receives the bonus, matching the refresh boundary.
  return state.lethalTempoUntil > 0 && canonicalTime(at) <= state.lethalTempoUntil ? state.lethalTempoStacks : 0;
}
