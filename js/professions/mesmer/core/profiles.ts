import type { BalanceProfile, SkillEffect, SkillId } from '../../../platform/engine/types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { MESMER_CORE_SHATTERS, MESMER_CORE_TRAIT_DAMAGE } from './mechanics.js';
import type {
  MesmerAmbushAttack,
  MesmerAttackStatus,
  MesmerInstrument,
  MesmerShatter,
  MesmerTraitDamage
} from '../types.js';

export const MESMER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.core.resources',
  mindWrack: 'mesmer.core.mind-wrack',
  cryOfFrustration: 'mesmer.core.cry-of-frustration',
  diversion: 'mesmer.core.diversion',
  distortion: 'mesmer.core.distortion',
  signetOfIllusions: 'mesmer.core.signet-of-illusions',
  signetOfTheEther: 'mesmer.core.signet-of-the-ether',
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
  masterOfMisdirection: TRAIT.MASTER_OF_MISDIRECTION,
  methodOfMadness: TRAIT.METHOD_OF_MADNESS,
  phantasmalHaste: TRAIT.PHANTASMAL_HASTE,
  sharperImages: TRAIT.SHARPER_IMAGES,
  shatterStorm: TRAIT.SHATTER_STORM,
  bountifulBlades: TRAIT.BOUNTIFUL_BLADES
});

export const MESMER_RESOURCE_PROFILE_IDS = Object.freeze({
  Core: MESMER_CORE_BALANCE_PROFILE_IDS.resources,
  Chronomancer: MESMER_CORE_BALANCE_PROFILE_IDS.resources,
  Mirage: MESMER_CORE_BALANCE_PROFILE_IDS.resources,
  Virtuoso: 'mesmer.virtuoso.resources',
  Troubadour: 'mesmer.troubadour.resources'
});

const trait = (id: SkillId, name: string, fields: Readonly<Record<string, unknown>> = {}): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

const variant = (
  id: string,
  parentId: SkillId,
  name: string,
  fields: Readonly<Record<string, unknown>> = {}
): BalanceProfile => ({
  id,
  parentId,
  name,
  profileKind: 'skill-variant',
  effects: [],
  ...fields
});

export function mesmerShatterProfile(
  id: string,
  parentId: SkillId,
  name: string,
  shatter: MesmerShatter,
  effects: readonly SkillEffect[] = []
): BalanceProfile {
  return variant(id, parentId, `${name} - Shatter`, {
    ...(shatter.rechargeReductionPerSource == null ? {} : { rechargeReduction: shatter.rechargeReductionPerSource }),
    effects: [
      ...shatter.coefficients.map((coefficient, resourceCount) => ({
        type: 'strike' as const,
        name: `${resourceCount} resources`,
        coefficient,
        hits: 1
      })),
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
      {
        type: 'strike',
        coefficient: damage.coefficient,
        hits: damage.hits,
        ...(damage.intervalMs == null
          ? {}
          : {
              intervalMs: damage.intervalMs,
              timingAnchor: 'castEnd',
              timingScale: 'fixed'
            })
      }
    ]
  });
}

function attackStatusEffect(status: MesmerAttackStatus, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'condition',
    source,
    condition: status.name,
    duration: status.duration,
    stacks: status.stacks
  };
}

function boonStatusEffect(status: MesmerAttackStatus, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'boon',
    source,
    boon: status.name.toLowerCase(),
    duration: status.duration,
    stacks: status.stacks
  };
}

export function mesmerAmbushProfile(id: string, attack: MesmerAmbushAttack): BalanceProfile {
  return variant(id, attack.id, `${attack.name} - Ambush`, {
    effects: [
      {
        type: 'strike',
        name: 'Player attack',
        source: 'Player',
        coefficient: attack.player.coefficient,
        hits: attack.player.hits
      },
      ...(attack.player.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications || 1) }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.playerBoons || []).map((status) => boonStatusEffect(status, 'Player')),
      {
        type: 'strike',
        name: 'Clone attack',
        source: 'Clone',
        coefficient: attack.clone.coefficient,
        hits: attack.clone.hits
      },
      ...(attack.clone.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications || 1) }, () => attackStatusEffect(status, 'Clone'))
      ),
      ...(attack.cloneBoons || []).map((status) => boonStatusEffect(status, 'Clone')),
      ...(attack.vulnerability
        ? [
            {
              type: 'buff' as const,
              name: 'Vulnerability',
              kind: 'target-vulnerability',
              duration: attack.vulnerability.duration,
              stacks: attack.vulnerability.stacks
            }
          ]
        : [])
    ]
  });
}

export function mesmerInstrumentProfile(
  id: string,
  parentId: SkillId,
  name: string,
  instrument: MesmerInstrument
): BalanceProfile {
  return variant(id, parentId, `${name} - Instrument`, {
    effects: [
      ...(instrument.hits > 0
        ? [
            {
              type: 'strike' as const,
              coefficient: instrument.coefficient,
              hits: instrument.hits,
              ...(instrument.intervalMs == null
                ? {}
                : {
                    intervalMs: instrument.intervalMs,
                    timingAnchor: 'castEnd' as const,
                    timingScale: 'fixed' as const
                  })
            }
          ]
        : []),
      ...(instrument.conditions || []).map((status) => ({
        type: 'condition' as const,
        condition: status.name,
        duration: status.duration,
        stacks: status.stacks,
        ...(status.applications == null ? {} : { applications: status.applications })
      }))
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
        ? [
            {
              type: 'condition',
              condition: 'Confusion',
              duration: 3,
              stacks: 1
            }
          ]
        : []
    )
  ),
  variant(MESMER_CORE_BALANCE_PROFILE_IDS.signetOfIllusions, ID.SIGNET_OF_ILLUSIONS, 'Signet of Illusions - Passive', {
    pulseInterval: 10,
    resourceGain: 1
  }),
  variant(
    MESMER_CORE_BALANCE_PROFILE_IDS.signetOfTheEther,
    ID.SIGNET_OF_THE_ETHER,
    'Signet of the Ether - Recharge Relock',
    { initialDelay: 0.3 }
  ),
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
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.cryOfPain, 'Cry of Pain', {
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        duration: 4,
        stacks: 2
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse, "Fencer's Finesse", {
    attributePerStack: 15,
    maximumStacks: 10,
    durationMultiplier: 6,
    rechargeMultiplier: 0.8
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.illusionaryMembrane, 'Illusionary Membrane', {
    effects: [
      {
        type: 'buff',
        kind: 'illusionary-membrane',
        duration: 15,
        stacks: 1
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.ineptitude, 'Ineptitude', {
    internalCooldown: 3,
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        duration: 5,
        stacks: 2
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.maimTheDisillusioned, 'Maim the Disillusioned', {
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        duration: 6,
        stacks: 1
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.maliciousSorcery, 'Malicious Sorcery', { durationMultiplier: 0.25 }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.masterFencer, 'Master Fencer', {
    internalCooldown: 8,
    effects: [
      {
        type: 'boon',
        name: 'Self Fury',
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
        maximumRecipients: 4
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.masterOfMisdirection, 'Master of Misdirection', { rechargeMultiplier: 0.85 }),
  mesmerTraitDamageProfile(
    MESMER_CORE_BALANCE_PROFILE_IDS.methodOfMadness,
    'Method of Madness',
    MESMER_CORE_TRAIT_DAMAGE['Lesser Chaos Storm']
  ),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.phantasmalHaste, 'Phantasmal Haste', {
    quicknessCastMultiplier: 1.5
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.sharperImages, 'Sharper Images', {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 5,
        stacks: 1
      }
    ]
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.shatterStorm, 'Shatter Storm', {
    maximumStacks: 2
  }),
  trait(MESMER_CORE_BALANCE_PROFILE_IDS.bountifulBlades, 'Bountiful Blades', {
    summons: 2,
    damageMultiplier: 0.66
  })
]);

type ProfileContext = {
  readonly catalog?: {
    readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
  };
  readonly helpers?: {
    readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
  };
  readonly profession?: {
    readonly catalog?: {
      readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
    };
  };
  readonly runtime?: {
    readonly profession?: {
      readonly catalog?: {
        readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
      };
    };
  };
};

export function mesmerBalanceProfile(context: unknown, id: SkillId): BalanceProfile | undefined {
  const source = (context || {}) as ProfileContext;
  return (
    source.catalog?.balanceProfilesById?.get(id) ||
    source.helpers?.balanceProfilesById?.get(id) ||
    source.profession?.catalog?.balanceProfilesById?.get(id) ||
    source.runtime?.profession?.catalog?.balanceProfilesById?.get(id)
  );
}

export function mesmerBalanceValue(context: unknown, id: SkillId, field: string, fallback: number): number {
  const value = mesmerBalanceProfile(context, id)?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function mesmerBalanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0
): SkillEffect | undefined {
  return profile?.effects?.filter((effect) => effect.type === type)[index];
}

export function mesmerProfiledShatters(
  context: unknown,
  shatters: Readonly<Record<number, MesmerShatter>>,
  profileIds: Readonly<Record<number, string>>
): Record<number, MesmerShatter> {
  return Object.fromEntries(
    Object.entries(shatters).map(([skillId, shatter]) => {
      const balanceProfileId = profileIds[Number(skillId)];
      const profile = mesmerBalanceProfile(context, balanceProfileId);
      const coefficients = (profile?.effects || [])
        .filter((effect) => effect.type === 'strike')
        .map((effect) => Number(effect.coefficient));
      return [
        Number(skillId),
        {
          ...shatter,
          balanceProfileId,
          coefficients:
            coefficients.length === shatter.coefficients.length && coefficients.every(Number.isFinite)
              ? coefficients
              : shatter.coefficients,
          ...(shatter.rechargeReductionPerSource == null
            ? {}
            : {
                rechargeReductionPerSource: mesmerBalanceValue(
                  context,
                  balanceProfileId,
                  'rechargeReduction',
                  shatter.rechargeReductionPerSource
                )
              })
        }
      ];
    })
  );
}

function profileStatuses(
  profile: BalanceProfile | undefined,
  type: 'condition' | 'boon',
  source: 'Player' | 'Clone'
): MesmerAttackStatus[] {
  return (profile?.effects || [])
    .filter((effect) => effect.type === type && effect.source === source)
    .map((effect) => ({
      name: String(type === 'condition' ? effect.condition || '' : effect.boon || ''),
      duration: Number(effect.duration || 0),
      stacks: Number(effect.stacks || 1),
      ...(effect.applications == null ? {} : { applications: Number(effect.applications) })
    }));
}

export function mesmerProfiledAmbush(
  context: unknown,
  attack: MesmerAmbushAttack,
  balanceProfileId: string
): MesmerAmbushAttack {
  const profile = mesmerBalanceProfile(context, balanceProfileId);
  const strikes = (profile?.effects || []).filter((effect) => effect.type === 'strike');
  const playerStrike = strikes.find((effect) => effect.source === 'Player');
  const cloneStrike = strikes.find((effect) => effect.source === 'Clone');
  const vulnerability = (profile?.effects || []).find(
    (effect) => effect.type === 'buff' && effect.kind === 'target-vulnerability'
  );
  return {
    ...attack,
    balanceProfileId,
    player: {
      ...attack.player,
      coefficient: Number(playerStrike?.coefficient ?? attack.player.coefficient),
      hits: Number(playerStrike?.hits ?? attack.player.hits),
      conditions: profile ? profileStatuses(profile, 'condition', 'Player') : attack.player.conditions
    },
    clone: {
      ...attack.clone,
      coefficient: Number(cloneStrike?.coefficient ?? attack.clone.coefficient),
      hits: Number(cloneStrike?.hits ?? attack.clone.hits),
      conditions: profile ? profileStatuses(profile, 'condition', 'Clone') : attack.clone.conditions
    },
    playerBoons: profile ? profileStatuses(profile, 'boon', 'Player') : attack.playerBoons,
    cloneBoons: profile ? profileStatuses(profile, 'boon', 'Clone') : attack.cloneBoons,
    vulnerability: vulnerability
      ? {
          duration: Number(vulnerability.duration || 0),
          stacks: Number(vulnerability.stacks || 1)
        }
      : attack.vulnerability
  };
}

export function mesmerProfiledInstrument(
  context: unknown,
  instrument: MesmerInstrument,
  balanceProfileId: string
): MesmerInstrument {
  const profile = mesmerBalanceProfile(context, balanceProfileId);
  const strike = mesmerBalanceProfileEffect(profile, 'strike');
  const conditions = (profile?.effects || [])
    .filter((effect) => effect.type === 'condition')
    .map((effect) => ({
      name: String(effect.condition || ''),
      duration: Number(effect.duration || 0),
      stacks: Number(effect.stacks || 1),
      ...(effect.applications == null ? {} : { applications: Number(effect.applications) })
    }));
  return {
    ...instrument,
    balanceProfileId,
    coefficient: Number(strike?.coefficient ?? instrument.coefficient),
    hits: Number(strike?.hits ?? instrument.hits),
    intervalMs: Number(strike?.intervalMs ?? (instrument.intervalMs || 0)),
    conditions: profile ? conditions : instrument.conditions
  };
}

export function mesmerProfiledTraitDamage(
  context: unknown,
  damage: MesmerTraitDamage,
  balanceProfileId: SkillId
): MesmerTraitDamage {
  const profile = mesmerBalanceProfile(context, balanceProfileId);
  const strike = mesmerBalanceProfileEffect(profile, 'strike');
  return {
    ...damage,
    balanceProfileId,
    coefficient: Number(strike?.coefficient ?? damage.coefficient),
    hits: Number(strike?.hits ?? damage.hits),
    intervalMs: Number(strike?.intervalMs ?? (damage.intervalMs || 0)),
    cooldown: mesmerBalanceValue(context, balanceProfileId, 'internalCooldown', Number(damage.cooldown || 0)),
    duration: mesmerBalanceValue(context, balanceProfileId, 'durationMultiplier', Number(damage.duration || 0)),
    damageIncrease: mesmerBalanceValue(context, balanceProfileId, 'damageIncrease', Number(damage.damageIncrease || 0))
  };
}

export { SHATTER_PROFILE_BY_SKILL_ID as MESMER_CORE_SHATTER_PROFILE_IDS };
