/**
 * Owns Chronomancer well, profession-skill, and Continuum action catalog data.
 * Continuum Split, Time Bomb, and shatter behavior live under `mechanics/` and `traits/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_CHRONOMANCER_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.WELL_OF_PRECOGNITION]: {
    castTimeMs: 800,
    // Protect allies during the well's three-second lifetime, then refund endurance when it ends.
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 3, startAnchor: 'castEnd' }],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      { type: 'boon', boon: 'stability', stacks: 1, duration: 1 },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'boon',
          boon: 'stability',
          stacks: 3,
          duration: 5,
          atMs: 1000
        },
        {
          type: 'custom',
          eventType: 'resource',
          event: { resource: 'endurance', amount: 30, name: 'Well of Precognition' },
          atMs: 3000
        }
      ])
    ]
  },
  [ID.CONTINUUM_SPLIT]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.WELL_OF_SENILITY]: {
    castTimeMs: 760,
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 3,
        atMs: 0,
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.WELL_OF_ETERNITY]: {
    castTimeMs: 400,
    effects: []
  },
  [ID.GRAVITY_WELL]: {
    castTimeMs: 1080,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 1.1 })),
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2000, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 0,
        controlKind: 'knockdown'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1000,
        controlKind: 'pull'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 2000,
        controlKind: 'float'
      }
    ])
  },
  [ID.WELL_OF_CALAMITY]: {
    castTimeMs: 800,
    // The well is created on its first observed pulse, so later pulses survive an interrupted cast after that point.
    interruptCommitMs: 560,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 3,
        startMs: 560,
        startAnchor: 'castStart'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [560, 1560, 2560].map((atMs) => ({ atMs, coefficient: 1.3 })),
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3560, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 2
        }))
      },
      {
        type: 'condition',
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({
          atMs,
          condition: 'Weakness',
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.WELL_OF_ACTION]: {
    // Store the measured Quickness duration so the catalog derives the corresponding base cast consistently.
    castTimeMs: 800,
    // The first pulse commits the well before its animation can be shortened by a shatter or another instant action.
    interruptCommitMs: 520,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 3,
        startMs: 520,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 1.5 },
          { atMs: 1520, coefficient: 1.5 },
          { atMs: 2520, coefficient: 1.5 }
        ],
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.TIME_SINK]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      { type: 'condition', condition: 'Slow', stacks: 1, duration: 2 }
    ]
  },
  [ID.REWINDER]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.SPLIT_SECOND]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  }
});

export const MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze(
  {}
);

export const MESMER_CHRONOMANCER_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.CONTINUUM_SHIFT,
    name: 'Continuum Shift',
    description: 'End Continuum Split early and restore the cooldown state captured when the split began.',
    icon: 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    specialization: 'Chronomancer',
    // Manual Continuum Shift restores the captured state when the action completes.
    mechanicTriggers: [
      {
        type: 'mesmer.chronomancer.restore-continuum',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);
