import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

// Apply Guardian's Burning-specific skill and trait multipliers before general
// condition-duration scaling.
export function modifyGuardianConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  if (context.condition !== 'Burning') return duration;
  let result = duration;
  if (
    (context.sourceId === ID.ZEALOTS_FLAME || context.event?.skillId === ID.ZEALOTS_FLAME) &&
    hasTrait(context, TRAIT.RADIANT_FIRE)
  ) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE);
    result *= balanceProfileNumber(radiantFireProfile, 'durationMultiplier');
  }

  if (
    (context.sourceId === 'guardian.justice-passive' || context.event?.sourceId === 'guardian.justice-passive') &&
    hasTrait(context, TRAIT.AMPLIFIED_WRATH)
  ) {
    const amplifiedWrathProfile = requireBalanceProfileFromContext(context, TRAIT.AMPLIFIED_WRATH);
    result *= balanceProfileNumber(amplifiedWrathProfile, 'durationMultiplier');
  }

  return result;
}

/** Signet passives keep their ordinary cooldown rule unless Perfect Inscriptions retains them. */
export function guardianSignetPassiveActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS) || !context.timeline?.skillOnCooldownAt(skillId, context.time);
}

/** Build and live signet grants read the same selected multiplier, including disabled-trait previews. */
export function perfectInscriptionsMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERFECT_INSCRIPTIONS), 'attributeMultiplier')
    : 1;
}

/** Select the same duration multiplier for the torch flip window and its Burning packets. */
export function radiantFireDurationMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.RADIANT_FIRE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE), 'durationMultiplier')
    : 1;
}
