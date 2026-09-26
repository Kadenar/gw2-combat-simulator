import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { GuardianConfig, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Recharge and ammunition formulas depend only on the selected catalog, traits, and skill. */
type GuardianSkillModifierContext = {
  readonly catalog: CanonicalCatalog;
  readonly config: GuardianConfig;
  readonly skill?: GuardianSkill;
};

/** Applies weapon- and virtue-specific trait recharge reductions to the selected skill. */
export function modifyGuardianRechargeDuration(context: GuardianSkillModifierContext, duration: number): number {
  const skill = context.skill;
  let result = duration;
  if (skill?.weapon === 'Greatsword' && hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    const zealousBladeProfile = requireBalanceProfileFromContext(context, PROFILE.zealousBlade);
    result *= balanceProfileNumber(zealousBladeProfile, 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Torch' && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, PROFILE.radiantFire);
    result *= balanceProfileNumber(radiantFireProfile, 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Focus' && hasTrait(context, GUARDIAN_TRAIT_IDS.FOCUS_MASTERY)) {
    const focusMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.focusMastery);
    result *= balanceProfileNumber(focusMasteryProfile, 'rechargeMultiplier');
  }

  if (
    skill?.categories?.includes('Virtue') &&
    /^Profession_[1-3]$/.test(String(skill.slot || '')) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  ) {
    const powerOfTheVirtuousProfile = requireBalanceProfileFromContext(context, PROFILE.powerOfTheVirtuous);
    result *= balanceProfileNumber(powerOfTheVirtuousProfile, 'rechargeMultiplier');
  }

  return result;
}

/** Raises charge capacity for skills whose selected traits grant extra ammunition. */
export function modifyGuardianMaximumAmmo(context: GuardianSkillModifierContext, maximum: number): number {
  let result = maximum;
  if (context.skill?.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, PROFILE.radiantFire);
    result = Math.max(result, balanceProfileNumber(radiantFireProfile, 'maximumStacks'));
  }

  if (context.skill?.categories?.includes('SpiritWeapon') && hasTrait(context, GUARDIAN_TRAIT_IDS.ETERNAL_ARMORY)) {
    const eternalArmoryProfile = requireBalanceProfileFromContext(context, PROFILE.eternalArmory);
    result += balanceProfileNumber(eternalArmoryProfile, 'resourceGain');
  }

  return result;
}
