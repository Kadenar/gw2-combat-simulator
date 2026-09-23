import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import type { GuardianCastContext, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';

export function applySoaringDevastation(context: GuardianCastContext, skill: GuardianSkill, skillWeapon: string): void {
  if (!hasTrait(context, TRAIT.SOARING_DEVASTATION)) return;
  const at = context.effectiveEnd;

  const soaringDevastationProfile = requireBalanceProfileFromContext(context, PROFILE.soaringDevastation);
  const strike = requireEffect(soaringDevastationProfile, 'strike', 'Strike');
  const immobilized = requireEffect(soaringDevastationProfile, 'condition', 'Immobilized');
  // skillWeapon must come from the caller (resolved to the active weapon set)
  // because traits.ts has no direct access to config at emit time.
  if (strike) {
    context.emit(
      buildGuardianStrike({
        at,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: 'Wings of Resolve — Soaring Devastation',
        coefficient: effectNumber(soaringDevastationProfile, strike, 'coefficient'),
        skillWeapon
      })
    );
  }
  if (immobilized) {
    emitSkillCondition(context, {
      skill,
      at,
      name: 'Soaring Devastation — Immobilized',
      condition: String(immobilized.condition),
      stacks: effectNumber(soaringDevastationProfile, immobilized, 'stacks'),
      duration: effectNumber(soaringDevastationProfile, immobilized, 'duration')
    });
  }
}

export function bigGameHunterTetherDuration(context: GuardianCastContext): number {
  // Big Game Hunter doubles tether duration (6 → 12s) and is also what
  // unlocks the Vulnerability condition and passive Crippled in the resolver.
  return hasTrait(context, TRAIT.BIG_GAME_HUNTER)
    ? balanceProfileNumberFromContext(context, PROFILE.bigGameHunter, 'pulseInterval')
    : 6;
}
