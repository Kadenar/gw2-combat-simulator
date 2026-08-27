import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';

export const DAREDEVIL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.IMPACT_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Impact Strike',
        actorType: 'player'
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
        coefficient: 4,
        hits: 1,
        name: 'Finishing Blow',
        actorType: 'player'
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
        coefficient: 2.25,
        hits: 1,
        name: 'Uppercut (Daredevil skill)',
        actorType: 'player'
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
        condition: 'Poisoned',
        stacks: 3,
        duration: 10,
        actorType: 'player',
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player',
        atMs: 520,
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
        coefficient: 0.75,
        hits: 1,
        name: 'Reflexive Strike',
        actorType: 'player'
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
        coefficient: 0.55,
        hits: 1,
        name: 'Distracting Daggers',
        actorType: 'player'
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
        coefficient: 1.75,
        hits: 1,
        name: 'Palm Strike',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 6.56,
        hits: 2,
        name: 'Pulmonary Impact',
        actorType: 'player',
        canCrit: false,
        atMs: 2000,
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
        coefficient: 3.28,
        hits: 1,
        name: 'Pulmonary Impact (trait skill)',
        actorType: 'player'
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
        condition: 'Vulnerability',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        atMs: 120,
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
        coefficient: 3.5,
        hits: 1,
        name: 'Bound',
        actorType: 'player'
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
