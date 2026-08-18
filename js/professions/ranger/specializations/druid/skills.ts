/** Explicit PvE skill mechanics owned by the Druid Ranger module. */
import { RANGER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

export const DRUID_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GLYPH_OF_THE_TIDES]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.GLYPH_OF_ALIGNMENT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.GLYPH_OF_REJUVENATION]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.RELEASE_CELESTIAL_AVATAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'ranger.celestial-avatar-exit'
  },
  [ID.GLYPH_OF_BURGEONING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.GLYPH_OF_THE_STARS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667
  },
  [ID.GLYPH_OF_EQUALITY]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.CELESTIAL_AVATAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'ranger.celestial-avatar-enter'
  },
  [ID.COSMIC_RAY]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.SEED_OF_LIFE]: {
    implemented: true,
    effects: [
      {
        type: 'blind',
        duration: 4
      }
    ],
    recharge: 4,
    cooldown: 4,
    castTimeMs: 0,
    canCastConcurrently: true,
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.LUNAR_IMPACT]: {
    implemented: true,
    effects: [
      {
        type: 'control',
        metadata: { controlKind: 'daze' },
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    recharge: 8,
    cooldown: 8,
    quicknessCastTimeMs: 500,
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.REJUVENATING_TIDES]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      }
    ],
    quicknessCastTimeMs: 333,
    handlerId: 'ranger.celestial-avatar-skill'
  },
  [ID.NATURAL_CONVERGENCE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [520, 1160, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.75
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2040, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
        ]),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        name: 'Black Hole',
        sourceId: ID.BLACK_HOLE,
        actorType: 'effect',
        ownerActorType: 'player',
        canCrit: false,
        ticks: [2640, 4160, 5680, 7200].map((atMs) => ({
          atMs,
          coefficient: 0,
          metadata: {
            flatDamage: 158,
            noCrit: true,
            skillName: 'Black Hole'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'pull',
          skillName: 'Black Hole'
        }
      },
      ...[520, 1160, 1640, 2040].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        duration: 10,
        stacks: 1,
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const
      }))
    ],
    recharge: 10,
    cooldown: 10,
    quicknessCastTimeMs: 2080,
    handlerId: 'ranger.celestial-avatar-skill'
  }
});
