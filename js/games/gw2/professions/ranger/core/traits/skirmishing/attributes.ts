import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { qualifiesForFlankingBonuses } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

// Apply skill-specific multipliers and convert flat shortbow extensions into
// multipliers before general Expertise scaling.
export function modifyRangerConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  let result = multiplier;
  const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
  if (skill?.categories?.includes('Trap') && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    return (
      multiplier *
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE),
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
      )
    );
  }

  // Intrinsic shortbow extensions remain native behavior, independent of preview duration overrides.
  // TODO -> THESE WILL BE GOING AWAY IN NOVEMBER PATCH
  let extension = 0;
  if (qualifiesForFlankingBonuses(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension += 1;
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      // Defiant foes already receive this intrinsic bonus in live; it is unchanged by the preview.
      extension += 2;
    }
  }

  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && qualifiesForFlankingBonuses(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'minimumStacks'
      );
    }
  }

  const baseDuration = Number(
    skill?.effects?.find((effect) => effect.type === 'condition' && effect.condition === context.condition)?.duration ||
      0
  );
  if (extension !== 0 && baseDuration > 0) result *= Math.max(0, baseDuration + extension) / baseDuration;
  return result;
}

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function skirmishingPetAttributes(
  context: RangerRuntime | RangerResolverContext,
  family: string
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.STRIDERS_STRENGTH, ['Power'], 'attributeBonus'],
    [TRAIT.FANG_AND_CLAW, ['Precision'], 'attributeBonus'],
    [TRAIT.FANG_AND_CLAW, ['Ferocity'], 'weaponAttributeBonus']
  ] as const;
  return declarations.flatMap(([id, attributes, field]) => {
    if (!hasTrait(context, id)) return [];
    if (id === TRAIT.FANG_AND_CLAW && !['feline', 'avian', 'drake'].includes(family)) return [];
    const amount = balanceProfileNumber(requireBalanceProfileFromContext(context, id), field);
    return attributes.map((to) => ({ kind: 'flat' as const, to, amount, feedsConversions: false }));
  });
}
