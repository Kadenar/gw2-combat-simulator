/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines non-Holosmith Engineer sword timing, damage, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RADIANT_ARC_ID_69565]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 14,
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
        name: 'Radiant Arc (non-holosmith)',
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
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SUN_RIPPER_ID_69906]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.02,
        hits: 1,
        name: 'Sun Ripper (non-holosmith)',
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE_ID_70514]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.96,
        hits: 1,
        name: 'Sun Edge (non-holosmith)',
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.GLEAM_SABER_ID_70771]: {
    implemented: true,
    handlerId: 'engineer.gleam-saber',
    quicknessCastTimeMs: 720,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Gleam Saber (non-holosmith)',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_ID_71121]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Refraction Cutter (non-holosmith) — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 2,
        atMs: 34,
        intervalMs: 51,
        timingAnchor: 'castEnd',
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
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        applications: 2,
        atMs: 34,
        intervalMs: 51,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
