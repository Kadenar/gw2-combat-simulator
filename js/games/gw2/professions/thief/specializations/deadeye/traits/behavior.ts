import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

/** Fire for Effect replaces Deadeye's stolen-skill choice pool with Steal Time. */
export function stolenSkillGrant(runtime: ThiefRuntime): {
  skillIds: readonly SkillId[];
  forcedSkillId: SkillId | null;
} {
  return hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT)
    ? { skillIds: [ID.STEAL_TIME], forcedSkillId: ID.STEAL_TIME }
    : { skillIds: DEADEYE_STOLEN_SKILL_IDS, forcedSkillId: null };
}

export const STOLEN_SKILLS = new Set<SkillId>(DEADEYE_STOLEN_SKILL_IDS);

/** The replacement cap is resolved from the active patch during initialization. */
export function maximumDeadeyeMalice(runtime: ThiefRuntime): number {
  return balanceProfileNumber(
    requireBalanceProfileFromContext(
      runtime,
      hasTrait(runtime, TRAIT.MALEFICENT_SEVEN) ? TRAIT.MALEFICENT_SEVEN : PROFILE.resources
    ),
    'maximumStacks'
  );
}

/** Malicious Intent seeds a fresh mark (and each spent cycle) with its starting malice. */
export function initialMalice(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.MALICIOUS_INTENT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_INTENT), 'resourceGain')
    : 0;
}

export function activeBoonCount(context: Gw2ModifierContext): number {
  return countActiveBoons(context);
}
