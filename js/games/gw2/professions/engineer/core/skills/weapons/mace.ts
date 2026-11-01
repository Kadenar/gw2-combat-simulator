/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer mace skill damage, conditions, boons, control, and combo behavior. */
export const ENGINEER_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.MACE_STRIKE]: {
    name: 'Mace Strike',
    description: 'Strike your target.',
    icon: 'https://render.guildwars2.com/file/4B0AA4C45F984870770F3B194F14459AB780CB9C/2503670.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mace Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MACE_SMASH]: {
    name: 'Mace Smash',
    description: 'Smash your target with a heavy blow from your mace, inflicting confusion.',
    icon: 'https://render.guildwars2.com/file/6FB7E71DFAA30995F3A9587A4BD17656EDA2A34B/2503671.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mace Smash',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 2,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MACE_BLAST]: {
    name: 'Mace Blast',
    description: 'Smash your target with a final heavy strike, inflicting additional confusion.',
    icon: 'https://render.guildwars2.com/file/FE1439232977E061A7E67A72C058B162ED426057/2503672.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 520,
    // Mace Blast is both an Explosion for Engineer traits and a leap combo finisher.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Mace Blast',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ENERGIZING_SLAM]: {
    name: 'Energizing Slam',
    description:
      'Leap forward and smash the ground, inflicting conditions on foes while granting barrier and boons to allies.',
    icon: 'https://render.guildwars2.com/file/3A0E770BC6328033C6B44F2567287AAA0649FD31/2503673.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.85,
        hits: 1,
        name: 'Energizing Slam',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ROCKET_FIST_PROTOTYPE]: {
    name: 'Rocket Fist Prototype',
    description: 'Launch a fist that explodes on the first target hit, damaging and stunning nearby enemies.',
    icon: 'https://render.guildwars2.com/file/7302D5096DE5D3BE485605945B5E4BCBD652974A/2503674.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Rocket Fist Prototype',
        actorType: ACTOR.PLAYER,
        // The fist explodes on impact while the traveling fist is a physical projectile finisher.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ],
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  }
});
