import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Decodes the selected grant, lifetime, and live cap for a single Tempo trigger. */
export function lethalTempoParameters(context: unknown) {
  const tyrantsMomentum = hasTrait(context, TRAIT.TYRANTS_MOMENTUM);
  const profileId = tyrantsMomentum ? TRAIT.TYRANTS_MOMENTUM : TRAIT.LETHAL_TEMPO;
  const profile = requireBalanceProfileFromContext(context, profileId);
  const window = requireEffect(profile, 'buff', 'lethal-tempo');
  if (!window) return undefined;
  const lethalTempoProfile = requireBalanceProfileFromContext(context, TRAIT.LETHAL_TEMPO);
  return {
    maximumStacks: balanceProfileNumber(lethalTempoProfile, 'maximumStacks'),
    stacks: effectNumber(profile, window, 'stacks'),
    duration: effectNumber(profile, window, 'duration')
  };
}

export function activeLethalTempo(state: GuardianWillbenderState, at: number): number {
  // Damage on the final effect tick still receives the bonus, matching the refresh boundary.
  return activeRefreshedStacks(state.lethalTempo, canonicalTime(at), 'inclusive');
}

export function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

/** The mechanic opens the chosen profile window at its authored activation boundary. */
export function willbenderVirtueWindowProfile(runtime: Runtime, virtue: GuardianVirtue) {
  return requireBalanceProfileFromContext(
    runtime,
    virtue === 'justice' && hasTrait(runtime, TRAIT.TYRANTS_MOMENTUM) ? TRAIT.TYRANTS_MOMENTUM : PROFILE.virtueWindows
  );
}
