import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.

export function scrapperMaximumAmmo(context: EngineerRuntime, skill: EngineerSkill, maximum: number): number {
  return skill.id === ID.FUNCTION_GYRO && hasTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EX_MACHINA), 'maximumAmmo'),
        Number(maximum || 0)
      )
    : maximum;
}
