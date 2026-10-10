import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Applies Fell Beacon at the original attribute-conversion position. */
export function modifyFellBeaconAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.FELL_BEACON)) {
    const fellBeaconProfile = requireBalanceProfileFromContext(context, TRAIT.FELL_BEACON);
    // Fell Beacon converts 7% of condition damage into expertise; must use raw
    // gear stats (config.stats) not the merged attribute record because might
    // stacks and trait bonuses like Lingering Curse are already folded in there
    result.expertise +=
      (context.config?.stats?.conditionDamage || 0) * balanceProfileNumber(fellBeaconProfile, 'attributeConversion');
  }
}

/** Applies Sand Sage at the original attribute-conversion position. */
export function modifySandSageAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    // Bonus only applies when at least one shade is alive — check expiry timestamps against current sim time
    (necromancerRuntimeSpecializationState(context, 'Scourge').shades || []).some(
      (expiresAt: number) => expiresAt > context.time
    )
  ) {
    const sandSageProfile = requireBalanceProfileFromContext(context, TRAIT.SAND_SAGE);
    const bonus = balanceProfileNumber(sandSageProfile, 'attributeBonus');
    // Dynamic attribute queries may begin from sparse input stats, so normalize
    // absent duration attributes before applying Sand Sage's active-shade bonus.
    result.concentration = (result.concentration || 0) + bonus;
    result.expertise = (result.expertise || 0) + bonus;
  }
}

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
