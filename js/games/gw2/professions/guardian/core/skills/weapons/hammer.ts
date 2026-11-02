/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.HAMMER_SWING]: {
    name: 'Hammer Swing',
    icon: 'https://render.guildwars2.com/file/CDDCE227F218D8F1AFD49F46C57991E49666D964/103159.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    name: 'Hammer Bash',
    icon: 'https://render.guildwars2.com/file/18AE09A5E9424FAA35EFA33BB903A1062ACEF354/103160.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_PROTECTION]: {
    name: 'Symbol of Protection',
    icon: 'https://render.guildwars2.com/file/E56B3804B2F82E3256A82318E537D024DC57E271/103161.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',

    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 1,
        hits: 1,
        name: 'Symbol of Protection - Hammer Damage'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        // The symbol hits on creation and once per second for its two-second lifetime.
        coefficient: 0.5,
        atMs: 0,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Symbol of Protection - Symbol Damage'
      }
    ]
  },
  [ID.MIGHTY_BLOW]: {
    name: 'Mighty Blow',
    icon: 'https://render.guildwars2.com/file/7CF5FFD35624B6D243B97CE4344018C3F1E6ACB7/103682.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 4,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      }
    ]
  },
  [ID.GLACIAL_BLOW]: {
    name: 'Glacial Blow',
    icon: 'https://render.guildwars2.com/file/0B54C31BD12FD40F51C068D84A79BB6FCE6D2505/2075996.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 4,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2.5
      }
    ]
  },
  [ID.ZEALOTS_EMBRACE]: {
    name: "Zealot's Embrace",
    icon: 'https://render.guildwars2.com/file/53752EA071EBA20C3C2D79EB3949ED73C6BBCA40/103683.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.BANISH]: {
    name: 'Banish',
    icon: 'https://render.guildwars2.com/file/080F4AC49809C32040C80512EAEA769EE7EA4FB7/103109.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        // A landed strike refreshes the hammer leap, including its Glacial Heart replacement; misses grant no reset.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            do: [{ type: 'rechargeReset', skillIds: [ID.MIGHTY_BLOW, ID.GLACIAL_BLOW] }]
          }
        ],
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.LAUNCH
      }
    ]
  },
  [ID.RING_OF_WARDING]: {
    name: 'Ring of Warding',
    icon: 'https://render.guildwars2.com/file/13A76EA2D6E91C94503F030E3A47F60A6B4153D2/103092.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',

    cooldown: 30,
    castTimeMs: 520,
    // Ring is represented only by the five-second Light field relevant to combo resolution.
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  }
};
