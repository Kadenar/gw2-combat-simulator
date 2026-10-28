import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SelectedContentContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { balanceNumberFromContext, balanceProfileNumber, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianResolverContext, GuardianRuntime, GuardianVirtue } from '#gw2/professions/guardian/types.js';

/** Both emission paths read one trait multiplier without applying ordinary boon-duration scaling twice. */
export function guardianResolutionMultiplier(context: SelectedContentContext): number {
  return context.hasTrait(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
    ? balanceProfileNumber(context.requireBalanceProfile(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION), 'durationMultiplier')
    : 1;
}

/** Core and Willbender count accepted hits against their own base threshold unless Justice is traited. */
export function permeatingWrathThreshold(
  context: GuardianResolverContext,
  virtue: GuardianVirtue,
  baseThreshold: number
): number {
  return virtue === 'justice' && hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
    ? balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH, 'threshold')
    : baseThreshold;
}

/** Dragonhunter keeps pulse scheduling and passive readiness while this owner selects its interval. */
export function indomitableCourageInterval(runtime: GuardianRuntime, skill: Skill): number {
  return hasTrait(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
    ? balanceNumberFromContext(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE, 'pulseInterval')
    : skillNumber(skill, 'passiveInterval');
}

/** Ordinary virtue recharge and Firebrand dormancy share the current trait multiplier. */
export function powerOfTheVirtuousRechargeMultiplier(runtime: MechanicQueriesOf<GuardianRuntime>): number {
  return hasTrait(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
    ? balanceNumberFromContext(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, 'rechargeMultiplier')
    : 1;
}

/** Battle Presence shares Phoenix Protocol's boons without adding other simulated healing behavior. */
export function battlePresenceSharesBoons(context: unknown): boolean {
  return hasTrait(context, GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE);
}
