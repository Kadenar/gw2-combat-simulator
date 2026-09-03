/**
 * Owns Holosmith sword skill fragments and heat-aware sword variants.
 * Sword cast behavior shared with Core lives in `core/execution/sword.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Holosmith sword fragments to Holosmith module composition. */
export const HOLOSMITH_SWORD_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  // Holosmith owns the original sword IDs; Core owns the non-heat Weaponmaster variants.
  [ID.RADIANT_ARC]: {
    quicknessCastTimeMs: 840,
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'custom',
        eventType: 'engineer.radiant-arc-quickness',
        event: {
          name: 'Radiant Arc - quickness'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE]: {
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 350, coefficient: 0.88 }],
        name: 'Sun Edge',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 350, condition: 'Vulnerability', stacks: 1, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER]: {
    quicknessCastTimeMs: 520,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter - Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'custom',
        eventType: 'engineer.refraction-cutter-extra-blades',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Refraction Cutter extra blades'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_RIPPER]: {
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 450, coefficient: 0.93 }],
        name: 'Sun Ripper',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 450, condition: 'Vulnerability', stacks: 1, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.GLEAM_SABER]: {
    // Custom: Recharges the other sword skills after the cast; see `core/execution/sword.ts`.
    handlerId: 'engineer.gleam-saber',
    quicknessCastTimeMs: 720,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.5 }],
        name: 'Gleam Saber',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
