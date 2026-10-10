import type { Gw2TraitLookupContext } from '#gw2/platform/builds/selected-traits.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & { ferocity: number };
  if (hasTrait(context, TRAIT.GUNS_AND_GLORY) && runtimeBuffActive(context, 'guns-and-glory')) {
    const gunsAndGloryProfile = requireBalanceProfileFromContext(context, TRAIT.GUNS_AND_GLORY);
    result.ferocity += balanceProfileNumber(gunsAndGloryProfile, 'attributeBonus');
  }

  return result;
}

// Trait windows count only live self applications, never an ally's or companion's copy.
export function runtimeBuffActive(context: Gw2ModifierContext, kind: string): boolean {
  return activeBuffStacks({ ...context, timeline: undefined }, kind, 1) > 0;
}

export function maximumDragonCharges(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? balanceProfileNumber(dragonTriggerProfile, 'minimumStacks')
    : balanceProfileNumber(dragonTriggerProfile, 'maximumStacks');
}

export function dragonFlowPerInterval(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(dragonTriggerProfile, 'resourceCost');
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? cost *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARING_DRAGON), 'resourceCostMultiplier')
    : cost;
}

const SHARP_AS_THE_WIND_VARIANTS = new Map<number, number>([
  [ID.SWIFT_CUT, ID.SHARP_SWIFT_CUT],
  [ID.STEEL_DIVIDE, ID.SHARP_STEEL_DIVIDE],
  [ID.EXPLOSIVE_THRUST, ID.SHARP_EXPLOSIVE_THRUST],
  [ID.BLOOMING_FIRE, ID.SHARP_BLOOMING_FIRE],
  [ID.ARTILLERY_SLASH, ID.SHARP_ARTILLERY_SLASH],
  [ID.CYCLONE_TRIGGER, ID.SHARP_CYCLONE_TRIGGER],
  [ID.BREAK_STEP, ID.SHARP_BREAK_STEP],
  [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE],
  [ID.DRAGON_SLASH_BOOST, ID.SHARP_DRAGON_SLASH_BOOST],
  [ID.DRAGON_SLASH_REACH, ID.SHARP_DRAGON_SLASH_REACH]
]);

const SHARP_AS_THE_WIND_PARENTS = new Map(
  [...SHARP_AS_THE_WIND_VARIANTS].map(([parentId, variantId]) => [variantId, parentId])
);

export function resolveSharpAsTheWindSkillId(
  context: import('#gw2/platform/profession-definition/runtime-context.js').TraitSelectionContext,
  skillId: SkillId
): SkillId {
  const parentId = SHARP_AS_THE_WIND_PARENTS.get(Number(skillId)) ?? Number(skillId);
  const variantId = SHARP_AS_THE_WIND_VARIANTS.get(parentId);
  if (!variantId) return skillId;
  return context.hasTrait(TRAIT.SHARP_AS_THE_WIND) ? variantId : parentId;
}
