import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

const MINION_PROJECTILE_FINISHER = Object.freeze({
  ownerId: 'necromancer',
  finisherType: COMBO_FINISHER.PROJECTILE,
  chance: 1
});

/** Canonical actor skills preserve their own packets, stats, and recovery without player activations. */
export const NECROMANCER_MINION_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'blood-fiend attack',
    description: 'Automatically triggered blood-fiend attack effect.',
    icon: 'https://render.guildwars2.com/file/9BB42A45780BC6D0F5F8157BC26A64A3C31DAF02/103088.png',
    id: 'necromancer.minion.blood-fiend.attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    ...{
      parentId: ID.SUMMON_BLOOD_FIEND,
      minionKey: 'blood-fiend',
      // The idle-attack log (20261009-122024) measures animation start to impact, excluding approach time.
      openingAttackWindupMs: 880,
      // Measured animation plus fixed idle time; only the animation benefits from received Quickness.
      pulseInterval: 3.16,
      // Each minion owns its strike attributes in the selected attack skill.
      weaponStrength: 1048,
      basePower: 2400,
      damagePerCoefficient: 4338,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.TASTE_OF_DEATH
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.065,
        hits: 1,
        actorType: ACTOR.SUMMON,
        name: 'Summon Blood Fiend - Minion Attack',
        castTimeMs: 2000
      }
    ]
  },
  {
    name: 'bone-fiend attack',
    description: 'Automatically triggered bone-fiend attack effect.',
    icon: 'https://render.guildwars2.com/file/941C6A21F67EAD342859D2783715A10D79D0C236/103802.png',
    id: 'necromancer.minion.bone-fiend.attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    ...{
      parentId: ID.SUMMON_BONE_FIEND,
      minionKey: 'bone-fiend',
      // Retain the existing startup estimate until this minion has observed windup evidence.
      openingAttackWindupMs: 3080,
      pulseInterval: 3.08,
      commandRecoveryDelayMs: 2120,
      // Each minion owns its strike attributes in the selected attack skill.
      weaponStrength: 1048,
      basePower: 1500,
      damagePerCoefficient: 1430,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      alternateEvery: 4,
      commandId: ID.RIGOR_MORTIS
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON,
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
        actorType: ACTOR.SUMMON,
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
        actorType: ACTOR.SUMMON,
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
        actorType: ACTOR.SUMMON,
        sourceId: 3644,
        name: 'Bone Shard - Crippling Volley - Second Projectile',
        skillName: 'Bone Shard - Crippling Volley',
        packetLabel: 'alternate',
        comboFinishers: [MINION_PROJECTILE_FINISHER]
      },
      {
        name: CONDITION.CRIPPLED,
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        applications: 2,
        intervalMs: 40,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON,
        packetLabel: 'alternate'
      }
    ]
  },
  {
    name: 'bone-minion attack',
    description: 'Automatically triggered bone-minion attack effect.',
    icon: 'https://render.guildwars2.com/file/9369C81D9A6B4E026BD4F39A1F11495F35C24F6D/103804.png',
    id: 'necromancer.minion.bone-minion.attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    ...{
      parentId: ID.SUMMON_BONE_MINIONS,
      minionKey: 'bone-minion',
      // Both minions share the measured windup even when they reach the target at different times.
      openingAttackWindupMs: 720,
      pulseInterval: 3.56,
      // Each minion owns its strike attributes in the selected attack skill.
      weaponStrength: 1048,
      basePower: 2250,
      damagePerCoefficient: 4750,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.PUTRID_EXPLOSION
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.04,
        hits: 1,
        actorType: ACTOR.SUMMON,
        name: 'Summon Bone Minions - Minion Attack',
        castTimeMs: 1440
      }
    ]
  },
  {
    name: 'shadow-fiend attack',
    description: 'Automatically triggered shadow-fiend attack effect.',
    icon: 'https://render.guildwars2.com/file/79FD0497A0BD625E0AD19A3A93C60946CB6C46E1/103819.png',
    id: 'necromancer.minion.shadow-fiend.attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    ...{
      parentId: ID.SUMMON_SHADOW_FIEND,
      minionKey: 'shadow-fiend',
      // Retain the existing startup estimate independently of its repeat cadence.
      openingAttackWindupMs: 1760,
      pulseInterval: 1.76,
      commandRecoveryDelayMs: 3580,
      // Each minion owns its strike attributes in the selected attack skill.
      weaponStrength: 1048,
      basePower: 1700,
      damagePerCoefficient: 1750,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.HAUNT
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        actorType: ACTOR.SUMMON,
        sourceId: 3642,
        name: 'Slash'
      }
    ]
  },
  {
    name: 'flesh-golem attack',
    description: 'Automatically triggered flesh-golem attack effect.',
    icon: 'https://render.guildwars2.com/file/0C9376D8AC320CB10F43D6F9D37B5458316AC9DF/103840.png',
    id: 'necromancer.minion.flesh-golem.attack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    ...{
      parentId: ID.SUMMON_FLESH_GOLEM,
      minionKey: 'flesh-golem',
      // Only the first Slash's windup gates engagement; the existing three-hit chain remains unchanged.
      openingAttackWindupMs: 320,
      pulseInterval: 4,
      // Each minion owns its strike attributes in the selected attack skill.
      weaponStrength: 1048,
      basePower: 2500,
      damagePerCoefficient: 3744,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      commandId: ID.CHARGE
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.18,
        hits: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON,
        sourceId: 3653,
        // Both Slashes accelerate; Fist's animation and the chain's idle gaps remain fixed.
        castTimeMs: 1200,
        name: 'First Slash',
        skillName: 'Slash',
        icon: new URL('@images/wiki/fist.png', import.meta.url).href
      },
      {
        type: 'strike',
        coefficient: 0.18,
        hits: 1,
        atMs: 1280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON,
        sourceId: 3654,
        castTimeMs: 1200,
        name: 'Second Slash',
        skillName: 'Slash',
        icon: new URL('@images/wiki/fist.png', import.meta.url).href
      },
      {
        type: 'strike',
        coefficient: 0.29,
        hits: 1,
        atMs: 2560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON,
        sourceId: 3655,
        name: 'Fist',
        icon: new URL('@images/wiki/fist.png', import.meta.url).href,
        damagePerCoefficient: 3952
      }
    ]
  }
]);

/** All persistent summon activations share the minion lifetime controller. */
export const NECROMANCER_MINION_SUMMON_IDS = Object.freeze([
  ID.SUMMON_BLOOD_FIEND,
  ID.SUMMON_BONE_FIEND,
  ID.SUMMON_BONE_MINIONS,
  ID.SUMMON_SHADOW_FIEND,
  ID.SUMMON_FLESH_GOLEM
]);
