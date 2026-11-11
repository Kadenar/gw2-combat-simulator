/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const REVENANT_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.MISERY_SWIPE]: {
    name: 'Misery Swipe',
    icon: 'https://render.guildwars2.com/file/0418D8F15F0DF2594023CFBCE61A0A1126BA92C5/961465.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    interruptCommitMs: 280,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.35,
          hits: 1,
          name: 'Misery Swipe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.ANGUISH_SWIPE]: {
    name: 'Anguish Swipe',
    icon: 'https://render.guildwars2.com/file/493214BAC8430E04E2327EDEFDD3EB323A5A3913/961460.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 360,
    interruptCommitMs: 320,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
          name: 'Anguish Swipe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.MANIFEST_TOXIN]: {
    name: 'Manifest Toxin',
    icon: 'https://render.guildwars2.com/file/92803ED295CE684CF8235941E6A6AC1610F0F00F/961459.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 560,
    interruptCommitMs: 440,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.6,
          hits: 1,
          name: 'Manifest Toxin - Packet 1',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 12,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.SEARING_FISSURE]: {
    name: 'Searing Fissure',
    icon: 'https://render.guildwars2.com/file/3FAB9EB7587857745278027D29154ABC015710A6/961477.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    cooldown: 3,
    energyCost: 5,
    castTimeMs: 600,
    // Commit before cast end so later interrupts preserve the skill.
    interruptCommitMs: 440,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.5 }],
        name: 'Initial Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 1480 + index * 1000, coefficient: 0.75 / 3 })),
        name: 'Pulsing Strikes',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: CONDITION.BURNING, stacks: 3, duration: 3 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 1480 + index * 1000,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.ECHOING_ERUPTION]: {
    name: 'Echoing Eruption',
    icon: 'https://render.guildwars2.com/file/EBC404DE4ACFF17BDB0FF7BC9BF592641BA64046/961470.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
    ammoCastLockout: 8,
    cooldown: 8,

    energyCost: 5,
    castTimeMs: 960,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Echoing Eruption',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 9,
        stacks: 3
      }
    ])
  }
};
