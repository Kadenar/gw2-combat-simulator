/**
 * Scrapper Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ACTOR, BOON, COMBO_FIELD, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const SCRAPPER_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition>> = Object.freeze({
  [ID.RECONSTRUCTION_FIELD]: {
    name: 'Reconstruction Field',
    description: 'Establish a defensive field, granting protection to allies in its area.',
    icon: 'https://render.guildwars2.com/file/F857BC1EDD46D0CC0ECE722E0C9722E37654632C/1058595.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 25,
    toolbeltParentId: ID.MEDIC_GYRO,
    mechanicSlot: 1,
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 2,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.BYPASS_COATING]: {
    name: 'Bypass Coating',
    description: 'Splash a hypercoating on nearby allies, granting superspeed.',
    icon: 'https://render.guildwars2.com/file/9980FCE89CC479C45825F1E362DED036A9EC7164/1128589.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 20,
    toolbeltParentId: ID.BLAST_GYRO,
    castTimeMs: 0,
    effects: []
  },
  [ID.SHREDDER_GYRO]: {
    name: 'Shredder Gyro',
    description: 'Well. Deploy a shredder gyro to attack foes in the area and repeatedly use whirl finishers.',
    icon: 'https://render.guildwars2.com/file/E60C094A2349552EA6F6250D9B14E69BE91E4468/1128595.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    cooldown: 20,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 12 }, (_, index) => ({ atMs: 360 + index * 520, coefficient: 4.8 / 12 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Shredder Gyro',
        actorType: ACTOR.EFFECT
      }
    ]
  },
  [ID.MEDIC_GYRO]: {
    name: 'Medic Gyro',
    description: 'Well. Deploy a medic gyro to heal allies in the area.',
    icon: 'https://render.guildwars2.com/file/EE3F42039E92ACA301CC5090D3DDA974F5D8FFCF/1128587.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Well',
    cooldown: 20,
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: []
  },
  [ID.SNEAK_GYRO]: {
    name: 'Sneak Gyro',
    description: 'Well. Deploy a sneak gyro to provide stealth to allies in the area.',
    icon: 'https://render.guildwars2.com/file/45FB5559AC6432169509B427D3091C4F192AEC3B/1128596.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Well',
    cooldown: 45,
    castTimeMs: 520,
    effects: []
  },
  [ID.SPARE_CAPACITOR]: {
    name: 'Spare Capacitor',
    description: 'Set down a lightning capacitor to daze and damage foes near it.',
    icon: 'https://render.guildwars2.com/file/919392F16619ABBD2D7CC463B35A3ADFB07BCD1A/1128591.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 24,
    toolbeltParentId: ID.SHREDDER_GYRO,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [80, 200, 280, 360].map((atMs) => ({ atMs, coefficient: 4.8 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Spare Capacitor',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.BLAST_GYRO]: {
    name: 'Blast Gyro',
    description: 'Well. Unleash a blast gyro to begin a countdown to a tremendous blast.',
    icon: 'https://render.guildwars2.com/file/24296D225154B94E6DC670A134F4177AB980E777/1128592.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    cooldown: 15,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        ticks: [40, 120, 160, 200].map((atMs) => ({ atMs, coefficient: 11 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Blast Gyro',
        actorType: ACTOR.EFFECT
      },
      {
        type: 'control',
        actorType: ACTOR.EFFECT,
        controlKind: CONTROL.STUN
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 2
      }
    ]
  },
  [ID.FUNCTION_GYRO]: {
    name: 'Function Gyro',
    description:
      'Create a lightning field at the specified point. Then summon gyros to finish foes and revive allies within the field. The recharge of this skill is increased for each gyro created beyond the first.\nInterrupted gyros are destroyed.',
    icon: 'https://render.guildwars2.com/file/42BCB9C83B05D048C0E0BA1804F13D6FAC180DCD/2175057.png',
    type: 'Profession',
    slot: 'Profession_5',
    // Function Gyro occupies Scrapper's F5 but still triggers toolbelt traits.
    countsAsToolbeltSkill: true,
    cooldown: 25,
    mechanicSlot: 5,
    castTimeMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Function Gyro (tool belt skill)',
        actorType: ACTOR.PLAYER
      }
    ]
  }
});
