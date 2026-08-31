import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const DAREDEVIL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.IMPACT_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Impact Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ]
  },
  [ID.FINISHING_BLOW]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 4 }],
        name: 'Finishing Blow',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.UPPERCUT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.25 }],
        name: 'Uppercut (Daredevil skill)',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 0
        }
      }
    ]
  },
  [ID.IMPAIRING_DAGGERS]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 15,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 520, coefficient: 1 }
        ],
        name: 'Impairing Daggers',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Poisoned', stacks: 3, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Slow', stacks: 1, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: 'Immobilized', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CHANNELED_VIGOR]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 20,
    initiativeCost: 0,
    resourceGain: 125,
    effects: []
  },
  [ID.REFLEXIVE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.75 }],
        name: 'Reflexive Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ]
  },
  [ID.DISTRACTING_DAGGERS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    ammo: 3,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.55 }],
        name: 'Distracting Daggers',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 0.25
        }
      }
    ]
  },
  [ID.BANDITS_DEFENSE]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 16,
    initiativeCost: 0,
    effects: []
  },
  [ID.PALM_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Palm Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 6.56,
        hits: 2,
        atMs: 2000,
        name: 'Pulmonary Impact',
        actorType: 'player',
        canCrit: false,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.PULMONARY_IMPACT_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.28 }],
        name: 'Pulmonary Impact (trait skill)',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIST_FLURRY]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 16,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 120, coefficient: 0.75 },
          { atMs: 280, coefficient: 0.75 },
          { atMs: 400, coefficient: 0.75 },
          { atMs: 560, coefficient: 0.75 },
          { atMs: 680, coefficient: 0.75 }
        ],
        name: 'Fist Flurry',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 120, condition: 'Vulnerability', stacks: 1, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BOUND]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.5 }],
        name: 'Bound',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DASH_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.IMPALING_LOTUS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 200, coefficient: 0.1875 },
          { atMs: 360, coefficient: 0.1875 },
          { atMs: 520, coefficient: 0.1875 }
        ],
        name: 'Impaling Lotus',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Bleeding',
            stacks: 2,
            duration: 4
          },
          {
            atMs: 360,
            condition: 'Torment',
            stacks: 2,
            duration: 4
          },
          {
            atMs: 520,
            condition: 'Crippled',
            stacks: 1,
            duration: 3
          }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  }
});
