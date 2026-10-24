import { CONDITION } from '#gw2/platform/constants.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import type { MesmerShatter, MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { CHAOS_STORM_POISON_PROFILE } from '#gw2/professions/mesmer/core/skills/weapons/staff.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.core.resources',
  chaosStormPoison: CHAOS_STORM_POISON_PROFILE.id,
  etherClone: 'mesmer.core.ether-clone',
  signetOfIllusions: 'mesmer.core.signet-of-illusions',
  signetOfDomination: 'mesmer.core.signet-of-domination-passive',
  signetOfMidnight: 'mesmer.core.signet-of-midnight-passive',
  mimic: 'mesmer.core.mimic'
});

/** The shatter definition owns the profile identity used by authoring and runtime lookup. */
export function mesmerShatterProfile(
  parentId: SkillId,
  name: string,
  shatter: MesmerShatterDefinition
): BalanceProfile {
  return variant(shatter.balanceProfileId, parentId, `${name} - Shatter`, {
    ...(shatter.rechargeReductionPerSource == null ? {} : { rechargeReduction: shatter.rechargeReductionPerSource }),
    effects: [
      ...shatter.coefficients.map((coefficient, resourceCount) =>
        shatter.ticks?.[resourceCount]?.length
          ? {
              type: 'strike' as const,
              name: `${resourceCount} resources`,
              ticks: shatter.ticks[resourceCount],
              timingAnchor: 'castEnd' as const,
              timingScale: 'fixed' as const
            }
          : {
              type: 'strike' as const,
              name: `${resourceCount} resources`,
              coefficient,
              hits: 1
            }
      ),
      ...(shatter.effects ?? [])
    ]
  });
}

export const MESMER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  CHAOS_STORM_POISON_PROFILE,
  // The landed-hit reaction selects this ordinary condition profile instead of creating an excess clone.
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.etherClone, ID.ETHER_CLONE, 'Ether Clone - Clone Limit', {
    effects: [{ type: 'condition', condition: CONDITION.TORMENT, duration: 9, stacks: 1 }]
  }),
  {
    id: MESMER_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Mesmer Clone Resources',
    profileKind: 'mechanic',
    maximumStacks: 3,
    effects: []
  },
  ...Object.entries(MESMER_CORE_SHATTERS).map(([skillId, shatter]) =>
    mesmerShatterProfile(
      Number(skillId),
      {
        [ID.MIND_WRACK]: 'Mind Wrack',
        [ID.CRY_OF_FRUSTRATION]: 'Cry of Frustration',
        [ID.DIVERSION]: 'Diversion',
        [ID.DISTORTION]: 'Distortion'
      }[Number(skillId)] || `Shatter ${skillId}`,
      shatter
    )
  ),
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.signetOfIllusions, ID.SIGNET_OF_ILLUSIONS, 'Signet of Illusions - Passive', {
    pulseInterval: 10,
    resourceGain: 1
  }),
  variant(
    MESMER_CORE_BALANCE_PROFILE_IDS.signetOfDomination,
    ID.SIGNET_OF_DOMINATION,
    'Signet of Domination - Passive',
    { conditionDamageBonus: 180 }
  ),
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.signetOfMidnight, ID.SIGNET_OF_MIDNIGHT, 'Signet of Midnight - Passive', {
    expertiseBonus: 180
  }),
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.mimic, ID.MIMIC, 'Mimic', {
    duration: 10
  })
]);

// Compile only selected effects; removed tiers retain their identity and unrelated mechanic metadata.
export function mesmerProfiledShatter(context: unknown, shatter: MesmerShatterDefinition): MesmerShatter {
  const balanceProfileId = shatter.balanceProfileId;
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const { coefficients, ticks, ...mechanic } = shatter;
  const strikes = coefficients.map((_, tier) => requireEffect(profile, 'strike', `${tier} resources`));
  return {
    ...mechanic,
    balanceProfileId,
    strikes,
    // Confusion applications retain their own cadence when a strike tier is removed.
    conditionAtMs: shatter.kind === 'blade-confusion' ? ticks?.map((tier) => tier.map((tick) => tick.atMs)) : undefined,
    ...(shatter.rechargeReductionPerSource == null
      ? {}
      : {
          rechargeReductionPerSource: balanceProfileNumber(profile, 'rechargeReduction')
        })
  };
}

/** Capture the selected trait strike and weapon strength for phantasm bonus attacks. */
export function mesmerProfiledTraitDamage(context: unknown, balanceProfileId: SkillId): Partial<StrikeEffect> {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const strike = requireEffect(profile, 'strike', 'Strike');
  return {
    weaponStrength: profile.weaponStrength === undefined ? undefined : balanceProfileNumber(profile, 'weaponStrength'),
    ...strike,
    name: undefined
  };
}
