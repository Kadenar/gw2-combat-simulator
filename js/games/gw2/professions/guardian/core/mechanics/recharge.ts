import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { GuardianConfig, GuardianSkill, GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

/** Recharge and ammunition formulas depend only on the selected catalog, traits, and skill. */
type GuardianSkillModifierContext = {
  readonly catalog: CanonicalCatalog;
  readonly config: GuardianConfig;
  readonly skill?: GuardianSkill;
};

/** The same compiled rules serve ordinary skills and Luminary's manually started virtue recharge. */
export const guardianRechargeWork = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE,
    when: (_runtime, skill) => skill.weapon === 'Greatsword',
    multiplier: { profile: PROFILE.zealousBlade, field: 'rechargeMultiplier' }
  },
  {
    trait: GUARDIAN_TRAIT_IDS.RADIANT_FIRE,
    when: (_runtime, skill) => skill.weapon === 'Torch',
    multiplier: { profile: PROFILE.radiantFire, field: 'rechargeMultiplier' }
  },
  {
    trait: GUARDIAN_TRAIT_IDS.FOCUS_MASTERY,
    when: (_runtime, skill) => skill.weapon === 'Focus',
    multiplier: { profile: PROFILE.focusMastery, field: 'rechargeMultiplier' }
  },
  {
    trait: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS,
    when: (_runtime, skill) =>
      Boolean(skill.categories?.includes('Virtue')) && /^Profession_[1-3]$/.test(String(skill.slot || '')),
    multiplier: { profile: PROFILE.powerOfTheVirtuous, field: 'rechargeMultiplier' }
  }
]);

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
