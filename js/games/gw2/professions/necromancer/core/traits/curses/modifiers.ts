import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Apply Curses attribute conversions and duration bonuses in the existing modifier order. */

/** Applies Furious Demise at the original attribute-conversion position. */
export function modifyFuriousDemiseAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    const furiousDemiseProfile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_DEMISE);
    result.precision += balanceProfileNumber(furiousDemiseProfile, 'attributeBonus');
  }
}

/** Applies Target the Weak at the original attribute-conversion position. */
export function modifyTargetTheWeakAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
    const targetTheWeakProfile = requireBalanceProfileFromContext(context, TRAIT.TARGET_THE_WEAK);
    // Flat Precision from Furious Demise is present before the conversion.
    result.conditionDamage += Math.floor(
      result.precision * balanceProfileNumber(targetTheWeakProfile, 'attributeConversion')
    );
  }
}

/** Applies Lingering Curse at the original attribute-conversion position. */
export function modifyLingeringCurseAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
    const lingeringCurseProfile = requireBalanceProfileFromContext(context, TRAIT.LINGERING_CURSE);
    result.conditionDamage += balanceProfileNumber(lingeringCurseProfile, 'attributeBonus');
  }
}

export function modifyNecromancerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  return skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon === 'Scepter' &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_CURSE), 'durationMultiplier')
    : duration;
}
