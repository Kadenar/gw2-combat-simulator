import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

import {
  balanceNumberFromContext,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianVirtue, GuardianRuntime } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Decodes the selected grant, lifetime, and live cap for a single Tempo trigger. */
export function lethalTempoParameters(context: unknown) {
  const tyrantsMomentum = hasTrait(context, TRAIT.TYRANTS_MOMENTUM);
  const profileId = tyrantsMomentum ? TRAIT.TYRANTS_MOMENTUM : TRAIT.LETHAL_TEMPO;
  const profile = requireBalanceProfileFromContext(context, profileId);
  const window = requireEffect(profile, 'buff', 'lethal-tempo');

  if (!window) return undefined;

  return {
    maximumStacks: balanceNumberFromContext(context, TRAIT.LETHAL_TEMPO, 'maximumStacks'),
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

/** The selected virtue owns its window, with Tyrant's Momentum retaining its Justice override. */
export function willbenderVirtueWindow(runtime: GuardianRuntime, virtue: GuardianVirtue) {
  if (virtue === 'justice' && hasTrait(runtime, TRAIT.TYRANTS_MOMENTUM)) {
    const owner = requireBalanceProfileFromContext(runtime, TRAIT.TYRANTS_MOMENTUM);
    return { owner, effect: requireEffect(owner, 'buff', virtue) };
  }

  const owner = requireSkillFromContext(
    runtime,
    { justice: ID.RUSHING_JUSTICE, resolve: ID.FLOWING_RESOLVE, courage: ID.CRASHING_COURAGE }[virtue]
  );
  return { owner, effect: requireEffect(owner, 'buff', virtue, requireSkillAction(owner, 'virtue')) };
}
