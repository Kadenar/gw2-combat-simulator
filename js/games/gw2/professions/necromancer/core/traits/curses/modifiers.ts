import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

export function modifyNecromancerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  return skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon === 'Scepter' &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_CURSE), 'durationMultiplier')
    : duration;
}
