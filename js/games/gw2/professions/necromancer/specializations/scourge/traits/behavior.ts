import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';

import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns the trait decision at the existing availability integration boundary. */
export const heraldOfSorrowAvailability: NonNullable<
  RuntimeProfession<NecromancerRuntimeState, NecromancerSkill>['availability']
> = (runtime, skill) => {
  const herald = hasTrait(runtime, TRAIT.HERALD_OF_SORROW);
  if (skill.id === ID.SANDSTORM_SHROUD && !herald)
    return denySkillCast(skill, 'necromancer.trait-replacement', 'requires Herald of Sorrow.');
  if (skill.id === ID.DESERT_SHROUD && herald)
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'replaced by Sandstorm Shroud while Herald of Sorrow is selected.'
    );
  return { ready: true };
};

/** Owns the trait decision at the existing maximumAmmo integration boundary. */
export const sandSavantMaximumAmmo: NonNullable<
  RuntimeProfession<NecromancerRuntimeState, NecromancerSkill>['maximumAmmo']
> = (context, skill, maximum) => {
  return skill.id === ID.MANIFEST_SAND_SHADE && context.hasTrait(TRAIT.SAND_SAVANT)
    ? balanceProfileNumber(context.requireBalanceProfile(TRAIT.SAND_SAVANT), 'maximumStacks')
    : maximum;
};

/** Sand Savant selects the same profile for lifetime, capacity and recharge. */
export function sandSavantShadeProfile(runtime: NecromancerRuntime) {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.SAND_SAVANT) ? TRAIT.SAND_SAVANT : PROFILE.shade
  );
}
