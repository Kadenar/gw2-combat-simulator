import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SelectedContentContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

/** Both emission paths read one trait multiplier without applying ordinary boon-duration scaling twice. */
export function guardianResolutionMultiplier(context: SelectedContentContext): number {
  return context.hasTrait(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
    ? balanceProfileNumber(context.requireBalanceProfile(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION), 'durationMultiplier')
    : 1;
}

/** Selected consecrations extend the live skill packets before effect materialization. */
export const masterOfConsecrationsEffects: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS),
  profileId: GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS,
  transform: (_runtime, cast, effects) => [
    ...(cast.skill.effects ?? []),
    ...effects
      .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
      .map((effect) => {
        if (!effect.ticks?.length) throw new Error('Master of Consecrations requires explicit packet timelines.');
        return {
          ...effect,
          name: effect.type === 'strike' ? cast.skill.name : `${cast.skill.name} \u2014 Burning`,
          weapon: 'Unequipped'
        };
      })
  ]
};

/** Core and Willbender count accepted hits against their own base threshold unless Justice is traited. */
export function permeatingWrathThreshold(
  context: GuardianResolverContext,
  virtue: GuardianVirtue,
  baseProfile: string
): number {
  return balanceProfileNumber(
    requireBalanceProfileFromContext(
      context,
      virtue === 'justice' && hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
        ? GUARDIAN_TRAIT_IDS.PERMEATING_WRATH
        : baseProfile
    ),
    'threshold'
  );
}

/** Dragonhunter keeps pulse scheduling and passive readiness while this owner selects its interval. */
export function indomitableCourageInterval(runtime: Runtime, baseProfile: BalanceProfile): number {
  return balanceProfileNumber(
    hasTrait(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
      ? requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
      : baseProfile,
    'pulseInterval'
  );
}

/** Ordinary virtue recharge and Firebrand dormancy share the current trait multiplier. */
export function powerOfTheVirtuousRechargeMultiplier(runtime: MechanicQueriesOf<Runtime>): number {
  return hasTrait(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS),
        'rechargeMultiplier'
      )
    : 1;
}

/** Battle Presence shares Phoenix Protocol's boons without adding other simulated healing behavior. */
export function battlePresenceSharesBoons(context: unknown): boolean {
  return hasTrait(context, GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE);
}

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
