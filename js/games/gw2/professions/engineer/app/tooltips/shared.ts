import {
  tooltipFactorChange,
  skillTooltip,
  profileFact,
  tooltipNumber,
  tooltipProfile,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as HOLOSMITH } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

export const heatTiers = (balanceContext: ProfessionBalanceContext) => [
  `at or below ${HOLOSMITH_HEAT.highThreshold} heat`,
  `above ${HOLOSMITH_HEAT.highThreshold} heat`,
  `above ${tooltipNumber(tooltipProfile(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT), 'threshold')} heat with Enhanced Capacity Storage Unit`
];

export function heatStrikeFacts(balanceContext: ProfessionBalanceContext, profileId: SkillId) {
  return [
    profileFact(
      balanceContext,
      profileId,
      'highStrikeFactor',
      `Strike damage ${heatTiers(balanceContext)[1]}`,
      tooltipFactorChange
    ),
    profileFact(
      balanceContext,
      profileId,
      'enhancedStrikeFactor',
      `Strike damage ${heatTiers(balanceContext)[2]}`,
      tooltipFactorChange
    )
  ];
}

export const armFlipTooltip: DescribeSimulationTooltip = skillTooltip(
  'Activate this skill and unlock its consumable follow-up.'
);

export const gleamSaberTooltip: DescribeSimulationTooltip = skillTooltip(
  "Strike and reduce active recharge on your other sword skills. Holosmith's heat tier increases eligible sword strikes.",
  (balanceContext) => heatStrikeFacts(balanceContext, HOLOSMITH.swordHeatTier)
);
