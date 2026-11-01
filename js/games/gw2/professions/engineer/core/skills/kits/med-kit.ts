/** Core Engineer Med Kit skill mechanics. */
import { BOON, COMBO_FIELD, COMBO_FINISHER, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Med Kit. */
export const ENGINEER_MED_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition>> = Object.freeze({
  [ID.MED_KIT]: {
    name: 'Med Kit',
    description: 'Engineering Kit. Equip a kit that replaces your weapon with healing skills.',
    icon: 'https://render.guildwars2.com/file/206FCC2A05035FDB306AB5136E5F3AC0FC6467F3/103395.png',
    type: 'Heal',
    slot: 'Heal',
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.STOW_MED_KIT]: {
    name: 'Stow Med Kit',
    description: 'Stow your med kit.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Heal',
    slot: 'Heal',
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.MED_KIT,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.MED_BLASTER]: {
    name: 'Med Blaster',
    description:
      'Restore health to allies with several pulses of healing energy. Heals more for each boon on the ally.',
    icon: 'https://render.guildwars2.com/file/94A7A5711A4922DFF3BCB701D770D3BB06EE0A59/1012852.png',
    type: 'Weapon',
    slot: 'Weapon_1',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.MED_KIT,
    castTimeMs: 840,
    effects: []
  },
  [ID.BANDAGE_SELF]: {
    name: 'Bandage Self',
    description: 'Bandage your wounds and heal yourself.',
    icon: 'https://render.guildwars2.com/file/0C982310320AC3E2584E20727CB645D1C53C1906/102826.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 17,
    toolbeltParentId: ID.MED_KIT,
    mechanicSlot: 1,
    castTimeMs: 680,
    effects: []
  },
  [ID.BANDAGE_BLAST]: {
    name: 'Bandage Blast',
    description: 'Fire several bandages ahead of you to heal allies.',
    icon: 'https://render.guildwars2.com/file/F473E7A5D7D301A3B813443812C73338C073ABB2/102898.png',
    type: 'Weapon',
    slot: 'Weapon_2',

    cooldown: 8,
    kitId: ID.MED_KIT,
    castTimeMs: 360,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.CLEANSING_FIELD]: {
    name: 'Cleansing Field',
    description: 'Release purifying vapors to cleanse conditions from allies near you at each interval.',
    icon: 'https://render.guildwars2.com/file/4A5B72C612F4EEFE57E20E020EA82ED0219952E9/1983629.png',
    type: 'Weapon',
    slot: 'Weapon_3',

    cooldown: 15,
    kitId: ID.MED_KIT,
    castTimeMs: 400,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.VITAL_BURST]: {
    name: 'Vital Burst',
    description: 'Unleash a cascade of concentrated healing vapors around you.',
    icon: 'https://render.guildwars2.com/file/3FF9282CD06FDF087F31A1F334C56F032A2FD207/1983631.png',
    type: 'Weapon',
    slot: 'Weapon_4',

    cooldown: 20,
    kitId: ID.MED_KIT,
    castTimeMs: 0,
    effects: []
  },
  [ID.INFUSION_BOMB]: {
    name: 'Infusion Bomb',
    description: 'Throw a bomb that grants boons to nearby allies when it explodes.',
    icon: 'https://render.guildwars2.com/file/A9E8073549D17E37C46FD25D1D02F85DFCE9747A/1983630.png',
    type: 'Weapon',
    slot: 'Weapon_5',

    cooldown: 20,
    kitId: ID.MED_KIT,
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1
      }
    ]
  }
});
