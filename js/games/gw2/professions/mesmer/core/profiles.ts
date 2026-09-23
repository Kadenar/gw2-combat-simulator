import type { BalanceProfile, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/platform/profession-definition/balance-profiles.js';
import {
  requireEffectFromContext,
  requireBalanceProfileFromContext,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CORE_SHATTERS, MESMER_CORE_TRAIT_DAMAGE } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import type { MesmerShatter, MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

export const MESMER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.core.resources',
  mindWrack: 'mesmer.core.mind-wrack',
  cryOfFrustration: 'mesmer.core.cry-of-frustration',
  diversion: 'mesmer.core.diversion',
  distortion: 'mesmer.core.distortion',
  signetOfIllusions: 'mesmer.core.signet-of-illusions',
  signetOfDomination: 'mesmer.core.signet-of-domination-passive',
  signetOfMidnight: 'mesmer.core.signet-of-midnight-passive',
  mimic: 'mesmer.core.mimic',
  clarity: 'mesmer.core.clarity',
  chaoticPersistence: 1865,
  compoundingPower: TRAIT.COMPOUNDING_POWER,
  cryOfPain: TRAIT.CRY_OF_PAIN,
  fencersFinesse: TRAIT.FENCERS_FINESSE,
  illusionaryMembrane: TRAIT.ILLUSIONARY_MEMBRANE,
  ineptitude: TRAIT.INEPTITUDE,
  maimTheDisillusioned: TRAIT.MAIM_THE_DISILLUSIONED,
  maliciousSorcery: TRAIT.MALICIOUS_SORCERY,
  masterFencer: TRAIT.MASTER_FENCER,
  masterOfFragmentation: TRAIT.MASTER_OF_FRAGMENTATION,
  masterOfMisdirection: TRAIT.MASTER_OF_MISDIRECTION,
  methodOfMadness: TRAIT.METHOD_OF_MADNESS,
  phantasmalHaste: TRAIT.PHANTASMAL_HASTE,
  sharperImages: TRAIT.SHARPER_IMAGES,
  shatterStorm: TRAIT.SHATTER_STORM,
  bountifulBlades: TRAIT.BOUNTIFUL_BLADES,
  thePledge: TRAIT.THE_PLEDGE
});

export function mesmerShatterProfile(
  id: string,
  parentId: SkillId,
  name: string,
  shatter: MesmerShatterDefinition,
  effects: readonly SkillEffect[] = []
): BalanceProfile {
  return variant(id, parentId, `${name} - Shatter`, {
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
      ...effects
    ]
  });
}

export function mesmerTraitDamageProfile(id: SkillId, name: string, damage: MesmerTraitDamage): BalanceProfile {
  return trait(id, name, {
    ...(damage.cooldown == null ? {} : { internalCooldown: damage.cooldown }),
    ...(damage.duration == null ? {} : { durationMultiplier: damage.duration }),
    ...(damage.damageIncrease == null ? {} : { damageIncrease: damage.damageIncrease }),
    effects: [
      damage.ticks?.length
        ? { name: 'Strike', type: 'strike', ticks: damage.ticks, timingAnchor: 'castEnd', timingScale: 'fixed' }
        : { name: 'Strike', type: 'strike', coefficient: damage.coefficient, hits: damage.hits }
    ]
  });
}

const SHATTER_PROFILE_BY_SKILL_ID: Readonly<Record<number, string>> = Object.freeze({
  [ID.MIND_WRACK]: MESMER_CORE_BALANCE_PROFILE_IDS.mindWrack,
  [ID.CRY_OF_FRUSTRATION]: MESMER_CORE_BALANCE_PROFILE_IDS.cryOfFrustration,
  [ID.DIVERSION]: MESMER_CORE_BALANCE_PROFILE_IDS.diversion,
  [ID.DISTORTION]: MESMER_CORE_BALANCE_PROFILE_IDS.distortion
});

export const MESMER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MESMER_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Mesmer Clone Resources',
    profileKind: 'mechanic',
    maximumStacks: 3,
    effects: []
  },
  ...Object.entries(MESMER_CORE_SHATTERS).map(([skillId, shatter]) =>
    mesmerShatterProfile(
      SHATTER_PROFILE_BY_SKILL_ID[Number(skillId)],
      Number(skillId),
      {
        [ID.MIND_WRACK]: 'Mind Wrack',
        [ID.CRY_OF_FRUSTRATION]: 'Cry of Frustration',
        [ID.DIVERSION]: 'Diversion',
        [ID.DISTORTION]: 'Distortion'
      }[Number(skillId)] || `Shatter ${skillId}`,
      shatter,
      Number(skillId) === ID.CRY_OF_FRUSTRATION
        ? [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 3, stacks: 1 }]
        : []
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
  }),
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.clarity, ID.MIND_THE_GAP, 'Clarity', { durationMultiplier: 15 }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.chaoticPersistence, 'Chaotic Persistence', {
    expertiseBonus: 100,
    concentrationBonus: 250
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.compoundingPower, 'Compounding Power', {
    maximumStacks: 5,
    durationMultiplier: 8
  }),
  // Dazzling owns the debuff independently of any equipped relic.
  trait(TRAIT.DAZZLING, 'Dazzling', {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.cryOfPain, 'Cry of Pain', {
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse, "Fencer's Finesse", {
    attributePerStack: 15,
    maximumStacks: 10,
    durationMultiplier: 6,
    rechargeMultiplier: 0.8
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.illusionaryMembrane, 'Illusionary Membrane', {
    effects: [{ name: 'illusionary-membrane', type: 'buff', kind: 'illusionary-membrane', duration: 15, stacks: 1 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.ineptitude, 'Ineptitude', {
    internalCooldown: 3,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 5, stacks: 2 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.maimTheDisillusioned, 'Maim the Disillusioned', {
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 6, stacks: 1 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.maliciousSorcery, 'Malicious Sorcery', { durationMultiplier: 0.25 }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.masterFencer, 'Master Fencer', {
    internalCooldown: 8,
    effects: [
      {
        type: 'boon',
        name: 'Self Fury',
        audience: { recipients: 'self' },
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Allied Fury',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        // Personal Fury is separate, leaving all four recipient slots for allies.
        audience: { recipients: 'party', maximumRecipients: 4, affectsSelf: false }
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.masterOfMisdirection, 'Master of Misdirection', { rechargeMultiplier: 0.85 }),
  // Shared shatter improvements remain trait-owned across elite specializations.
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.masterOfFragmentation, 'Master of Fragmentation', {
    criticalChance: 0.25,
    durationMultiplier: 1,
    damageIncreasePerStack: 0.3,
    effects: [
      { name: 'Cripple', type: 'condition', condition: 'Cripple', duration: 3, stacks: 1 },
      // provisional 3s Weakness; replace when Deafening Drum's trait duration is confirmed.
      { name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 3, stacks: 1 }
    ]
  }),
  mesmerTraitDamageProfile(
    MESMER_CORE_BALANCE_PROFILE_IDS.methodOfMadness,
    'Method of Madness',
    MESMER_CORE_TRAIT_DAMAGE['Lesser Chaos Storm']
  ),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.phantasmalHaste, 'Phantasmal Haste', {
    quicknessCastMultiplier: 1.5
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.sharperImages, 'Sharper Images', {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 5, stacks: 1 }]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.shatterStorm, 'Shatter Storm', {
    maximumStacks: 2
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.bountifulBlades, 'Bountiful Blades', {
    summons: 2,
    damageMultiplier: 0.66,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        ticks: [
          { atMs: 1240, coefficient: 0.0000064 },
          { atMs: 1400, coefficient: 0.000000256 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }),

  trait(TRAIT.PHANTASMAL_FURY, 'Phantasmal Fury', {
    criticalChance: 0.25
  }),
  trait(TRAIT.CHAOTIC_INTERRUPTION, 'Chaotic Interruption', {
    recharge: 5,
    internalCooldown: 1
  }),
  trait(TRAIT.SUPERIORITY_COMPLEX, 'Superiority Complex', {
    highHealthFactor: 1.15,
    lowHealthOrDisabledFactor: 1.25,
    threshold: 0.5
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.thePledge, 'The Pledge', {
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', duration: 3, stacks: 2 }]
  })
]);

// Compile only selected effects; removed tiers retain their identity and unrelated mechanic metadata.
export function mesmerProfiledShatters(
  context: unknown,
  shatters: Readonly<Record<number, MesmerShatterDefinition>>,
  profileIds: Readonly<Record<number, string>>
): Record<number, MesmerShatter> {
  return Object.fromEntries(
    Object.entries(shatters).map(([skillId, shatter]) => {
      const balanceProfileId = profileIds[Number(skillId)];
      const { coefficients, ticks, ...mechanic } = shatter;
      const strikes = coefficients.map((_, tier) =>
        requireEffectFromContext(context, 'balance-profile', balanceProfileId, 'strike', `${tier} resources`)
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
                rechargeReductionPerSource: balanceProfileNumberFromContext(
                  context,
                  balanceProfileId,
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
  damage: MesmerTraitDamage,
  balanceProfileId: SkillId
): MesmerTraitDamage {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const strike = requireEffectFromContext(context, 'balance-profile', balanceProfileId, 'strike', 'Strike');
  // Balance attacks are replaceable; only mechanic metadata survives their removal.
  return {
    balanceProfileId,
    weaponStrength: damage.weaponStrength,
    ...strike,
    name: undefined,
    cooldown:
      damage.cooldown === undefined && profile.internalCooldown === undefined
        ? undefined
        : balanceProfileNumberFromContext(context, balanceProfileId, 'internalCooldown'),
    duration:
      damage.duration === undefined && profile.durationMultiplier === undefined
        ? undefined
        : balanceProfileNumberFromContext(context, balanceProfileId, 'durationMultiplier'),
    damageIncrease:
      damage.damageIncrease === undefined && profile.damageIncrease === undefined
        ? undefined
        : balanceProfileNumberFromContext(context, balanceProfileId, 'damageIncrease')
  };
}

export { SHATTER_PROFILE_BY_SKILL_ID as MESMER_CORE_SHATTER_PROFILE_IDS };
