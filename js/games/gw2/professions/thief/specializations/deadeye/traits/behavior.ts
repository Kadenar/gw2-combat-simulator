import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/data/stolen-skills.js';

/** Fire for Effect replaces Deadeye's stolen-skill choice pool with Steal Time. */
export function stolenSkillGrant(runtime: ThiefRuntime): readonly SkillId[] {
  return hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT) ? [ID.STEAL_TIME] : DEADEYE_STOLEN_SKILL_IDS;
}

/** The replacement cap is resolved from the active patch during initialization. */
export function maximumDeadeyeMalice(runtime: ThiefRuntime): number {
  return balanceNumber(
    runtime.helpers,
    hasTrait(runtime, TRAIT.MALEFICENT_SEVEN) ? TRAIT.MALEFICENT_SEVEN : TRAIT.DEADEYES_GAZE,
    'maximumStacks'
  );
}

/** Malicious Intent seeds a fresh mark (and each spent cycle) with its starting malice. */
export function initialMalice(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.MALICIOUS_INTENT)
    ? balanceNumber(runtime.helpers, TRAIT.MALICIOUS_INTENT, 'resourceGain')
    : 0;
}
