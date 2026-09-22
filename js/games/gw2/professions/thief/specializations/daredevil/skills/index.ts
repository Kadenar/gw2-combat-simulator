import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const DAREDEVIL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.IMPACT_STRIKE]: {
    castTimeMs: 360,
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
        controlKind: 'daze'
      }
    ]
  },
  [ID.FINISHING_BLOW]: {
    castTimeMs: 1000,
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
    castTimeMs: 520,
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
        controlKind: 'launch'
      }
    ]
  },
  [ID.IMPAIRING_DAGGERS]: {
    castTimeMs: 480,
    cooldown: 15,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 520, coefficient: 1 }
        ],
        name: 'Impairing Daggers',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Poisoned', stacks: 3, duration: 10 }],
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Slow', stacks: 1, duration: 5 }],
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: 'Immobilized', stacks: 1, duration: 2 }],
        actorType: 'player'
      }
    ])
  },
  [ID.CHANNELED_VIGOR]: {
    castTimeMs: 480,
    // The endurance grant commits at 440 ms, allowing the remaining cast to be interrupted.
    interruptCommitMs: 440,
    cooldown: 20,
    initiativeCost: 0,
    resourceGain: 125,
    effects: []
  },
  [ID.REFLEXIVE_STRIKE]: {
    castTimeMs: 360,
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
        controlKind: 'knockdown'
      }
    ]
  },
  [ID.DISTRACTING_DAGGERS]: {
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
        controlKind: 'daze'
      }
    ]
  },
  [ID.BANDITS_DEFENSE]: {
    castTimeMs: 1000,
    cooldown: 16,
    initiativeCost: 0,
    effects: []
  },
  [ID.PALM_STRIKE]: {
    castTimeMs: 480,
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
        controlKind: 'stun'
      }
    ]
  },
  [ID.PULMONARY_IMPACT_TRAIT_SKILL]: {
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
    castTimeMs: 680,
    cooldown: 16,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Fist Flurry',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 120, condition: 'Vulnerability', stacks: 1, duration: 5 }],
        actorType: 'player'
      }
    ])
  },
  [ID.BOUND]: {
    castTimeMs: 520,
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
    castTimeMs: 520,
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
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [200, 360, 520].map((atMs) => ({ atMs, coefficient: 0.1875 })),
        name: 'Impaling Lotus',
        actorType: 'player'
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
        actorType: 'player'
      }
    ]),
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  }
});
