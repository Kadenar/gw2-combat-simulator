/** Explicit PvE skill mechanics owned by the Druid Ranger module. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const DRUID_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.GLYPH_OF_REJUVENATION]: {
    effects: [],
    castTimeMs: 333
  },
  [ID.RELEASE_CELESTIAL_AVATAR]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Leaves Celestial Avatar and updates its state; see `druid/module.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'ranger.celestial-avatar-exit'
  },
  [ID.GLYPH_OF_THE_STARS]: {
    effects: [],
    castTimeMs: 667
  },
  [ID.CELESTIAL_AVATAR]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Enters Celestial Avatar and initializes its astral-force state; see `druid/module.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'ranger.celestial-avatar-enter'
  },
  [ID.COSMIC_RAY]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    effects: [],
    castTimeMs: 333,
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.SEED_OF_LIFE]: {
    effects: [
      {
        type: 'blind',
        duration: 4
      }
    ],

    cooldown: 4,
    castTimeMs: 0,
    canCastConcurrently: true,
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.LUNAR_IMPACT]: {
    effects: [
      {
        type: 'control',
        controlKind: 'daze',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],

    cooldown: 8,
    // Match the measured Quickness animation from the condition Druid EVTC.
    castTimeMs: 920,
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.REJUVENATING_TIDES]: {
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1,
        applications: 5,
        atMs: 960,
        intervalMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ],
    castTimeMs: 480,
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.NATURAL_CONVERGENCE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [520, 1160, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.75
        }))
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2040, coefficient: 2 }]
      },
      {
        type: 'condition',
        ticks: [520, 1160, 1640, 2040].flatMap((atMs) => [
          {
            atMs,
            condition: 'Crippled',
            stacks: 1,
            duration: 1
          },
          { atMs, condition: 'Slow', stacks: 1, duration: 1 }
        ])
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 2640,
            condition: 'Immobilized',
            stacks: 1,
            duration: 4
          }
        ]
      },
      {
        type: 'strike',
        name: 'Black Hole',
        // This child effect has no catalog entry, so carry its dedicated icon into damage breakdown rows.
        icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Black_Hole.png',
        sourceId: ID.BLACK_HOLE,
        skillName: 'Black Hole',
        actorType: 'effect',
        ownerActorType: 'player',
        canCrit: false,
        ticks: [2640, 4160, 5680, 7200].map((atMs) => ({
          atMs,
          coefficient: 0,
          flatDamage: 158,
          noCrit: true
        }))
      },
      {
        type: 'control',
        name: 'Black Hole',
        sourceId: ID.BLACK_HOLE,
        actorType: 'effect',
        ownerActorType: 'player',
        applications: 4,
        atMs: 2640,
        intervalMs: 1520,
        controlKind: 'pull',
        skillName: 'Black Hole'
      },
      ...[520, 1160, 1640, 2040].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        duration: 10,
        stacks: 1,
        atMs,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }))
    ]),

    cooldown: 10,
    castTimeMs: 2080,
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
    handlerId: 'ranger.celestial-avatar-skill'
  }
});
