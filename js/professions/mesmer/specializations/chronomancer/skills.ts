/**
 * Raw Chronomancer skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import type { Skill, SkillFragment, SkillId } from '../../../../platform/engine/types.js';
import type { MesmerSkill } from '../../types.js';

export const MESMER_CHRONOMANCER_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.WELL_OF_PRECOGNITION]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 60,
    phantasm: false,
    resource: null,
    blade: false,
    effects: []
  },
  [ID.CONTINUUM_SPLIT]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 105,
    phantasm: false,
    resource: null,
    blade: false,
    effects: []
  },
  [ID.WELL_OF_SENILITY]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 1140,
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 3,
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.WELL_OF_ETERNITY]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 166.666666667,
    cooldown: 30,
    phantasm: false,
    resource: null,
    blade: false,
    effects: []
  },
  [ID.GRAVITY_WELL]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1080,
    cooldown: 60,
    phantasm: false,
    resource: null,
    blade: false,
    effects: [
      {
        type: 'strike',
        coefficient: 3.3,
        hits: 3,
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility',
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.1,
        hits: 1,
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility',
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: { controlKind: 'knockdown' }
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: { controlKind: 'pull' }
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: { controlKind: 'float' }
      }
    ]
  },
  [ID.WELL_OF_CALAMITY]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 950,
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
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
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.1,
        hits: 1,
        name: 'Final damage',
        actorType: 'player',
        weapon: 'utility',
        atMs: 3554,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_ACTION]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 1200,
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: false,
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 3,
        name: 'Pulse damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.TIME_SINK]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 38,
    phantasm: false,
    resource: null,
    blade: false,
    effects: []
  },
  [ID.REWINDER]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 30,
    phantasm: false,
    resource: null,
    blade: false,
    effects: []
  },
  [ID.SPLIT_SECOND]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Chronomancer',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 12,
    phantasm: false,
    resource: null,
    blade: false,
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
    implemented: true,
    effects: []
  }
] satisfies readonly MesmerSkill[]);
