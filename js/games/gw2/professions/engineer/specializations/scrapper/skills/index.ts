/**
 * Scrapper Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ACTOR, BOON, COMBO_FIELD, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const SCRAPPER_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.RECONSTRUCTION_FIELD]: {
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
    cooldown: 20,
    toolbeltParentId: ID.BLAST_GYRO,
    castTimeMs: 0,
    effects: []
  },
  [ID.SHREDDER_GYRO]: {
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
    cooldown: 45,
    castTimeMs: 520,
    effects: []
  },
  [ID.SPARE_CAPACITOR]: {
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
