import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';
import {
  defineTraitProfile as trait,
  defineSkillVariantProfile as variant
} from '#gw2/platform/profession-definition/balance-profiles.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerShatter, MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.core.resources',
  etherClone: 'mesmer.core.ether-clone',
  mindWrack: 'mesmer.core.mind-wrack',
  cryOfFrustration: 'mesmer.core.cry-of-frustration',
  distortion: 'mesmer.core.distortion',
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

// Profiles tune trait packets and timers; damage multipliers belong to executable modifier rules.
export function mesmerTraitDamageProfile(id: SkillId, name: string, damage: MesmerTraitDamage): BalanceProfile {
  return trait(id, name, {
    ...(damage.cooldown == null ? {} : { internalCooldown: damage.cooldown }),
    ...(damage.duration == null ? {} : { durationMultiplier: damage.duration }),
    effects: [
      damage.ticks?.length
        ? { name: 'Strike', type: 'strike', ticks: damage.ticks, timingAnchor: 'castEnd', timingScale: 'fixed' }
        : { name: 'Strike', type: 'strike', coefficient: damage.coefficient, hits: damage.hits }
    ]
  });
}

export const MESMER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // The landed-hit reaction selects this ordinary condition profile instead of creating an excess clone.
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.etherClone, ID.ETHER_CLONE, 'Ether Clone - Clone Limit', {
    effects: [{ type: 'condition', condition: 'Torment', duration: 9, stacks: 1 }]
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
    durationMultiplier: 10
  })
]);

// Compile only selected effects; removed tiers retain their identity and unrelated mechanic metadata.
export function mesmerProfiledShatters(
  context: unknown,
  shatters: Readonly<Record<number, MesmerShatterDefinition>>
): Record<number, MesmerShatter> {
  return Object.fromEntries(
    Object.entries(shatters).map(([skillId, shatter]) => {
      const balanceProfileId = shatter.balanceProfileId;
      const { coefficients, ticks, ...mechanic } = shatter;
      const strikes = coefficients.map((_, tier) =>
        requireEffect(requireBalanceProfileFromContext(context, balanceProfileId), 'strike', `${tier} resources`)
      );
      return [
        Number(skillId),
        {
          ...mechanic,
          balanceProfileId,
          strikes,
          // Confusion applications retain their own cadence when a strike tier is removed.
          conditionAtMs:
            shatter.kind === 'blade-confusion' ? ticks?.map((tier) => tier.map((tick) => tick.atMs)) : undefined,
          ...(shatter.rechargeReductionPerSource == null
            ? {}
            : {
                rechargeReductionPerSource: balanceProfileNumber(
                  requireBalanceProfileFromContext(context, balanceProfileId),
                  'rechargeReduction'
                )
              })
        }
      ];
    })
  );
}

export function mesmerProfiledTraitDamage(
  context: unknown,
  metadata: { readonly weaponStrength?: number; readonly requiresCooldown?: boolean },
  balanceProfileId: SkillId
): MesmerTraitDamage {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const strike = requireEffect(profile, 'strike', 'Strike');
  // Runtime callers supply only mechanic metadata; all attack tuning comes from the active profile.
  return {
    balanceProfileId,
    weaponStrength: metadata.weaponStrength,
    ...strike,
    name: undefined,
    cooldown:
      !metadata.requiresCooldown && profile.internalCooldown === undefined
        ? undefined
        : balanceProfileNumber(profile, 'internalCooldown'),
    duration: profile.durationMultiplier === undefined ? undefined : balanceProfileNumber(profile, 'durationMultiplier')
  };
}
