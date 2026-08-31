/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIND_STAB]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Greatsword',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.8 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 480
  },
  [ID.SPATIAL_SURGE]: {
    implemented: true,
    interruptMode: 'per-packet',
    type: 'Weapon',
    weapon: 'Greatsword',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 760,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.2666666666666667 },
          { atMs: 520, coefficient: 0.2666666666666667 },
          { atMs: 680, coefficient: 0.2666666666666667 }
        ],
        name: 'Minimum-range damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    pulseCount: 3
  },
  [ID.ILLUSIONARY_WAVE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Greatsword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 960,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 401, coefficient: 0.3 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Greatsword',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 12,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 4,
        name: 'One berserker',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm high'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Greatsword damage',
        actorType: 'player',
        weapon: 'greatsword'
      }
    ],
    castTimeMs: 840
  },
  [ID.MIRROR_BLADE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Greatsword',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 900,
    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1
    },
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 602, coefficient: 2.5 }],
        name: 'Initial target hit',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 767, coefficient: 0.1 }],
        name: 'Second target hit after one ally bounce',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 918, coefficient: 0.004 }],
        name: 'Third target hit after two ally bounces',
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1084, coefficient: 0.00016 }],
        name: 'Fourth target hit after three ally bounces',
        requiredTrait: 686,
        actorType: 'player',
        weapon: 'greatsword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
