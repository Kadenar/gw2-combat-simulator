/**
 * Raw Virtuoso skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.THOUSAND_CUTS]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 0,
    cooldown: 60,
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5
          },
          {
            atMs: 517,
            coefficient: 0.5
          },
          {
            atMs: 1033,
            coefficient: 0.5
          },
          {
            atMs: 1550,
            coefficient: 0.5
          },
          {
            atMs: 2067,
            coefficient: 0.5
          },
          {
            atMs: 2600,
            coefficient: 0.5
          },
          {
            atMs: 3117,
            coefficient: 0.5
          },
          {
            atMs: 3633,
            coefficient: 0.5
          },
          {
            atMs: 4150,
            coefficient: 0.5
          },
          {
            atMs: 4667,
            coefficient: 0.5
          }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SWORD_OF_DECIMATION]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 25,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.BLADE_RENEWAL]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1333.333333333,
    cooldown: 35,
    resource: {
      mode: 'fill',
      count: 5
    },
    blade: true,
    effects: []
  },
  [ID.RAIN_OF_SWORDS]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 1020,
    cooldown: 25,
    blade: true,
    effects: [
      {
        type: 'strike',
        // Rain begins after the ground-target delay observed in EVTC, then pulses once per second.
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          coefficient: 1.2
        })),
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 10
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 20,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped'
      }
    ]
  },
  [ID.PSYCHIC_FORCE]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 3,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.BLADETURN_REQUIEM]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    cooldown: 30,
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISSONANCE]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 720,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    cooldown: 30,
    blade: true,
    effects: []
  },
  [ID.BLADESONG_SORROW]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 720,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    cooldown: 20,
    blade: true,
    effects: []
  },
  [ID.BLADESONG_HARMONY]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 960,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    cooldown: 12,
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISTORTION]: {
    implemented: true,
    type: 'Profession',
    weapon: '',
    specialization: 'Virtuoso',
    environment: 'Terrestrial',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 50,
    blade: true,
    effects: []
  }
});
