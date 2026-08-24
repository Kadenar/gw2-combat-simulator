import type { BalanceProfile, SkillEffect, SkillId } from '../../../platform/engine/types.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';

export const NECROMANCER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  soulShards: 'necromancer.core.soul-shards',
  shroud: 'necromancer.core.death-shroud',
  signetOfVampirismPassive: 'necromancer.core.signet-of-vampirism-passive',
  signetOfUndeathPassive: 'necromancer.core.signet-of-undeath-passive',
  summonAttributes: 'necromancer.core.summon-attributes',
  bloodFiendAttack: 'necromancer.core.minion.blood-fiend',
  boneFiendAttack: 'necromancer.core.minion.bone-fiend',
  boneMinionAttack: 'necromancer.core.minion.bone-minion',
  shadowFiendAttack: 'necromancer.core.minion.shadow-fiend',
  fleshGolemAttack: 'necromancer.core.minion.flesh-golem',
  dhuumfire: TRAIT.DHUUMFIRE,
  unyieldingBlast: TRAIT.UNYIELDING_BLAST,
  barbedPrecision: TRAIT.BARBED_PRECISION,
  vampiric: TRAIT.VAMPIRIC,
  vampiricPresence: TRAIT.VAMPIRIC_PRESENCE,
  overflowingThirst: TRAIT.OVERFLOWING_THIRST,
  chillingDarkness: TRAIT.CHILLING_DARKNESS,
  insidiousDisruption: TRAIT.INSIDIOUS_DISRUPTION,
  reapersMight: TRAIT.REAPERS_MIGHT,
  siphonedPower: TRAIT.SIPHONED_POWER,
  chillOfDeath: TRAIT.CHILL_OF_DEATH,
  signetOfSpite: 'necromancer.core.signet-of-spite-passive',
  fleshOfTheMaster: TRAIT.FLESH_OF_THE_MASTER,
  deadlyStrength: TRAIT.DEADLY_STRENGTH,
  awakenThePain: TRAIT.AWAKEN_THE_PAIN,
  spitefulFortitude: TRAIT.SPITEFUL_FORTITUDE,
  furiousDemise: TRAIT.FURIOUS_DEMISE,
  targetTheWeak: TRAIT.TARGET_THE_WEAK,
  lingeringCurse: TRAIT.LINGERING_CURSE,
  vitalPersistence: TRAIT.VITAL_PERSISTENCE,
  spitefulSpirit: TRAIT.SPITEFUL_SPIRIT
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

const minion = (
  id: string,
  name: string,
  fields: Readonly<Record<string, unknown>>,
  effects: readonly SkillEffect[]
): BalanceProfile => ({
  id,
  name,
  profileKind: 'skill-variant',
  actorType: 'summon',
  ...fields,
  effects
});

const MINION_PROJECTILE_FINISHER = Object.freeze({
  ownerId: 'necromancer',
  finisherType: 'Projectile',
  chance: 1,
  ambiguousFieldSelection: 'oldest'
});

export const NECROMANCER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.soulShards,
    name: 'Soul Shards - Detonation',
    profileKind: 'mechanic',
    maximumStacks: 6,
    threshold: 0.5,
    damageMultiplier: 1.5,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 1504,
        flatStrikePowerCoeff: 0.1,
        actorType: 'effect',
        name: 'Soul Shards',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.shroud,
    name: 'Death Shroud',
    profileKind: 'mechanic',
    lifeForceDrain: 3,
    effects: []
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.signetOfVampirismPassive,
    name: 'Signet of Vampirism - Passive',
    profileKind: 'skill-variant',
    pulseInterval: 3,
    attributeBonus: 180,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 129,
        flatStrikePowerCoeff: 0.03,
        actorType: 'effect',
        name: 'Signet of Vampirism - Passive Life Siphon',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.signetOfSpite,
    name: 'Signet of Spite - Passive',
    profileKind: 'mechanic',
    attributeBonus: 180,
    effects: []
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.signetOfUndeathPassive,
    name: 'Signet of Undeath - Passive',
    profileKind: 'skill-variant',
    pulseInterval: 3,
    lifeForceGain: 4,
    effects: []
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.summonAttributes,
    name: 'Necromancer Summon Attributes',
    profileKind: 'mechanic',
    weaponStrength: 1048,
    effects: []
  },
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.dhuumfire, 'Dhuumfire', {
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.unyieldingBlast, 'Unyielding Blast', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 10,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.barbedPrecision, 'Barbed Precision', {
    criticalChance: 0.33,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.vampiric, 'Vampiric', {
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 38,
        flatStrikePowerCoeff: 0.003,
        actorType: 'effect',
        packetLabel: 'player',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 50,
        flatStrikePowerCoeff: 0.0213,
        actorType: 'effect',
        packetLabel: 'minion',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.vampiricPresence, 'Vampiric Presence', {
    cooldown: 0.5,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 65,
        flatStrikePowerCoeff: 0.0333,
        actorType: 'effect',
        packetLabel: 'base',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 129,
        flatStrikePowerCoeff: 0.0666,
        actorType: 'effect',
        packetLabel: 'shroud',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.overflowingThirst, 'Overflowing Thirst', {
    effects: [
      {
        type: 'effect',
        kind: 'taste-for-blood',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 375,
        flatStrikePowerCoeff: 0.05,
        hits: 1,
        actorType: 'effect',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.chillingDarkness, 'Chilling Darkness', {
    cooldown: 3,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.insidiousDisruption, 'Insidious Disruption', {
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.reapersMight, "Reaper's Might", {
    effects: [
      {
        type: 'boon',
        boon: 'might',
        stacks: 1,
        duration: 15,
        actorType: 'player'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.siphonedPower, 'Siphoned Power', {
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        stacks: 3,
        duration: 8,
        actorType: 'player'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.chillOfDeath, 'Chill of Death', {
    cooldown: 16,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Lesser Spinal Shivers - No Boons',
        actorType: 'effect'
      },
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Lesser Spinal Shivers - One Boon',
        actorType: 'effect'
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Lesser Spinal Shivers - Two Boons',
        actorType: 'effect'
      },
      {
        type: 'strike',
        coefficient: 2.1,
        hits: 1,
        name: 'Lesser Spinal Shivers - Three Boons',
        actorType: 'effect'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.fleshOfTheMaster, 'Flesh of the Master', {
    resourceGain: 2,
    maximumStacks: 30
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.deadlyStrength, 'Deadly Strength', { attributePerStack: 10 }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.awakenThePain, 'Awaken the Pain', {
    attributePerStack: 10
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.spitefulFortitude, 'Spiteful Fortitude', {
    attributeConversion: 0.1,
    lifeForceGain: 1
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.furiousDemise, 'Furious Demise', {
    attributeBonus: 180
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.targetTheWeak, 'Target the Weak', {
    attributeConversion: 0.13
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.lingeringCurse, 'Lingering Curse', {
    attributeBonus: 200,
    durationMultiplier: 1.5
  }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.vitalPersistence, 'Vital Persistence', { attributeBonus: 180 }),
  trait(NECROMANCER_CORE_BALANCE_PROFILE_IDS.spitefulSpirit, 'Spiteful Spirit', {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        actorType: 'effect'
      }
    ]
  }),
  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.bloodFiendAttack,
    'Blood Fiend - Fiend Leech',
    {
      parentId: ID.SUMMON_BLOOD_FIEND,
      minionKey: 'blood-fiend',
      minionCount: 1,
      pulseInterval: 3.1,
      basePower: 2400,
      damagePerCoefficient: 4338,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.TASTE_OF_DEATH
    },
    [
      {
        type: 'strike',
        coefficient: 0.065,
        hits: 1,
        actorType: 'summon',
        name: 'Summon Blood Fiend - Minion Attack'
      }
    ]
  ),
  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.boneFiendAttack,
    'Bone Fiend - Bone Shard',
    {
      parentId: ID.SUMMON_BONE_FIEND,
      minionKey: 'bone-fiend',
      minionCount: 1,
      pulseInterval: 3.08,
      rechargeOffsetMs: 2120,
      basePower: 1500,
      damagePerCoefficient: 1430,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      alternateEvery: 4,
      commandId: ID.RIGOR_MORTIS
    },
    [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3633,
        name: 'Bone Shard',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3633,
        name: 'Bone Shard',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3644,
        name: 'Bone Shard - Crippling Volley',
        packetLabel: 'alternate',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3644,
        name: 'Bone Shard - Crippling Volley',
        packetLabel: 'alternate',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        applications: 2,
        intervalMs: 40,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon',
        packetLabel: 'alternate'
      }
    ]
  ),
  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.boneMinionAttack,
    'Bone Minion - Slash',
    {
      parentId: ID.SUMMON_BONE_MINIONS,
      minionKey: 'bone-minion',
      minionCount: 2,
      pulseInterval: 3.52,
      basePower: 2250,
      damagePerCoefficient: 4750,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.PUTRID_EXPLOSION
    },
    [
      {
        type: 'strike',
        coefficient: 0.04,
        hits: 1,
        actorType: 'summon',
        name: 'Summon Bone Minions - Minion Attack'
      }
    ]
  ),
  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.shadowFiendAttack,
    'Shadow Fiend - Slash',
    {
      parentId: ID.SUMMON_SHADOW_FIEND,
      minionKey: 'shadow-fiend',
      minionCount: 1,
      pulseInterval: 1.76,
      rechargeOffsetMs: 3580,
      basePower: 1700,
      damagePerCoefficient: 1750,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.HAUNT
    },
    [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        actorType: 'summon',
        sourceId: 3642,
        name: 'Slash'
      }
    ]
  ),
  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.fleshGolemAttack,
    'Flesh Golem - Attack Chain',
    {
      parentId: ID.SUMMON_FLESH_GOLEM,
      minionKey: 'flesh-golem',
      minionCount: 1,
      initialDelay: 2.2,
      pulseInterval: 4,
      basePower: 2500,
      damagePerCoefficient: 3744,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.CHARGE
    },
    [
      {
        type: 'strike',
        coefficient: 0.18,
        hits: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3653,
        name: 'Slash',
        icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png'
      },
      {
        type: 'strike',
        coefficient: 0.18,
        hits: 1,
        atMs: 1280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3654,
        name: 'Slash',
        icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png'
      },
      {
        type: 'strike',
        coefficient: 0.29,
        hits: 1,
        atMs: 2560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        sourceId: 3655,
        name: 'Fist',
        icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png',
        damagePerCoefficient: 3952
      }
    ]
  )
]);

export const NECROMANCER_MINION_PROFILE_BY_SKILL_ID: Readonly<Record<number, string>> = Object.freeze({
  [ID.SUMMON_BLOOD_FIEND]: NECROMANCER_CORE_BALANCE_PROFILE_IDS.bloodFiendAttack,
  [ID.SUMMON_BONE_FIEND]: NECROMANCER_CORE_BALANCE_PROFILE_IDS.boneFiendAttack,
  [ID.SUMMON_BONE_MINIONS]: NECROMANCER_CORE_BALANCE_PROFILE_IDS.boneMinionAttack,
  [ID.SUMMON_SHADOW_FIEND]: NECROMANCER_CORE_BALANCE_PROFILE_IDS.shadowFiendAttack,
  [ID.SUMMON_FLESH_GOLEM]: NECROMANCER_CORE_BALANCE_PROFILE_IDS.fleshGolemAttack
});

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
};

export function necromancerBalanceProfile(context: unknown, id: SkillId): BalanceProfile | undefined {
  const source = context as ProfileContext;
  return (
    source.catalog?.balanceProfilesById?.get(id) ||
    source.helpers?.balanceProfilesById?.get(id) ||
    source.profession?.catalog?.balanceProfilesById?.get(id)
  );
}

export function balanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0
): SkillEffect | undefined {
  return profile?.effects?.filter((effect) => effect.type === type)[index];
}
