/**
 * Raw Chronomancer skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export const MESMER_CHRONOMANCER_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.WELL_OF_PRECOGNITION]: {
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 60,
    effects: []
  },
  [ID.CONTINUUM_SPLIT]: {
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 105,
    effects: []
  },
  [ID.WELL_OF_SENILITY]: {
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    castTimeMs: 1140,
    cooldown: 20,
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
    type: 'Heal',
    weapon: '',
    specialization: 'Chronomancer',
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: []
  },
  [ID.GRAVITY_WELL]: {
    type: 'Elite',
    weapon: '',
    specialization: 'Chronomancer',
    quicknessCastTimeMs: 1080,
    cooldown: 60,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 0, coefficient: 1.1 },
          { atMs: 1000, coefficient: 1.1 },
          { atMs: 2000, coefficient: 1.1 }
        ],
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2000, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: 'knockdown'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: 'pull'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: 'float'
      }
    ]
  },
  [ID.WELL_OF_CALAMITY]: {
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    quicknessCastTimeMs: 800,
    cooldown: 20,
    // The well is created on its first observed pulse, so later pulses survive an interrupted cast after that point.
    interruptCommitMs: 559,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 3,
        startMs: 559,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 559, coefficient: 1.3 },
          { atMs: 1559, coefficient: 1.3 },
          { atMs: 2561, coefficient: 1.3 }
        ],
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3554, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [559, 1559, 2561, 3554].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [559, 1559, 2561, 3554].map((atMs) => ({
          atMs,
          condition: 'Weakness',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_ACTION]: {
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    // Store the measured Quickness duration so the catalog derives the corresponding base cast consistently.
    quicknessCastTimeMs: 800,
    cooldown: 20,
    // The first pulse commits the well before its animation can be shortened by a shatter or another instant action.
    interruptCommitMs: 518,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 3,
        startMs: 518,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 518, coefficient: 1.5 },
          { atMs: 1519, coefficient: 1.5 },
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
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 38,
    effects: []
  },
  [ID.REWINDER]: {
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 30,
    effects: []
  },
  [ID.SPLIT_SECOND]: {
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 12,
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
