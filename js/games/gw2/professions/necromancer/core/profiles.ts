import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
// Name packets independently for patch deletion while preserving their shared attribution.

export const NECROMANCER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  addleDaze: 'necromancer.core.addle-daze',
  addleImmobilize: 'necromancer.core.addle-immobilize',
  darkPactOnHit: 'necromancer.core.dark-pact-on-hit',
  lifeSiphonOnHit: 'necromancer.core.life-siphon-on-hit',
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
  signetOfSpite: 'necromancer.core.signet-of-spite-passive'
});

// Stamp the shared summon profile shape onto each minion's declarative balance fields and effects.
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
  // Addle's landed strike selects these packets; its acceptance snapshot gates only Immobilized.
  variant(NECROMANCER_CORE_BALANCE_PROFILE_IDS.addleDaze, ID.ADDLE, 'Addle Daze', {
    effects: [{ type: 'control', name: 'Daze', controlKind: 'daze' }]
  }),
  variant(NECROMANCER_CORE_BALANCE_PROFILE_IDS.addleImmobilize, ID.ADDLE, 'Addle Immobilized', {
    effects: [{ type: 'condition', name: 'Immobilized', condition: 'Immobilized', stacks: 1, duration: 1.5 }]
  }),
  variant(NECROMANCER_CORE_BALANCE_PROFILE_IDS.darkPactOnHit, ID.DARK_PACT, 'Dark Pact — First Hit', {
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10, target: 'self' },
      { name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 6 }
    ]
  }),
  variant(NECROMANCER_CORE_BALANCE_PROFILE_IDS.lifeSiphonOnHit, ID.LIFE_SIPHON, 'Life Siphon — First Hit', {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, target: 'self' }]
  }),
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
        canCrit: false,
        damageKind: 'life-steal'
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
        canCrit: false,
        damageKind: 'life-steal'
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

  minion(
    NECROMANCER_CORE_BALANCE_PROFILE_IDS.bloodFiendAttack,
    'Blood Fiend - Fiend Leech',
    {
      parentId: ID.SUMMON_BLOOD_FIEND,
      minionKey: 'blood-fiend',
      minionCount: 1,
      // Measured animation plus fixed idle time; only the animation benefits from received Quickness.
      pulseInterval: 3.16,
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
        name: 'Summon Blood Fiend - Minion Attack',
        castTimeMs: 2000
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
      commandRecoveryDelayMs: 2120,
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
        name: 'Bone Shard - First Projectile',
        skillName: 'Bone Shard',
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
        name: 'Bone Shard - Second Projectile',
        skillName: 'Bone Shard',
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
        name: 'Bone Shard - Crippling Volley - First Projectile',
        skillName: 'Bone Shard - Crippling Volley',
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
        name: 'Bone Shard - Crippling Volley - Second Projectile',
        skillName: 'Bone Shard - Crippling Volley',
        packetLabel: 'alternate',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        name: 'Crippled',
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
      pulseInterval: 3.56,
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
        name: 'Summon Bone Minions - Minion Attack',
        castTimeMs: 1440
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
      commandRecoveryDelayMs: 3580,
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
        // Both Slashes accelerate; Fist's animation and the chain's idle gaps remain fixed.
        castTimeMs: 1200,
        name: 'First Slash',
        skillName: 'Slash',
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
        castTimeMs: 1200,
        name: 'Second Slash',
        skillName: 'Slash',
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
