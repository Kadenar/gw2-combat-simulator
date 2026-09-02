/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DOUBLE_STRIKE]: {
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 160, coefficient: 0.4 },
          { atMs: 280, coefficient: 0.4 }
        ],
        name: 'Double Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BACKSTAB]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 320,
    interruptCommitMs: 200,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true
  },
  [ID.DEATH_BLOSSOM]: {
    movementSkill: true,
    quicknessCastTimeMs: 1040,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.21 },
          { atMs: 640, coefficient: 0.21 },
          { atMs: 800, coefficient: 0.21 }
        ],
        name: 'Death Blossom',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 560, condition: 'Bleeding', stacks: 2, duration: 6 },
          { atMs: 640, condition: 'Bleeding', stacks: 2, duration: 6 },
          { atMs: 800, condition: 'Bleeding', stacks: 2, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Dagger'
  },
  [ID.DANCING_DAGGER]: {
    quicknessCastTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.9 }],
        name: 'Dancing Dagger',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Torment', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHADOW_SHOT]: {
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.8 }],
        name: 'Shadow Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 5
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Pistol'
  },
  [ID.WILD_STRIKE]: {
    quicknessCastTimeMs: 400,
    // Wild Strike commits its strike and bleeding on the ~160 ms impact before the chain animation ends.
    interruptCommitMs: 160,
    cooldown: 0,
    initiativeCost: 0,
    resourceGain: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 0.8 }],
        name: 'Wild Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 160, condition: 'Bleeding', stacks: 2, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.HEARTSEEKER]: {
    movementSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Heartseeker',
        actorType: 'player',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.25,
            multiplier: 2.22
          },
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.6
          }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.LOTUS_STRIKE]: {
    quicknessCastTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 1.2 }],
        name: 'Lotus Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Poisoned', stacks: 2, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TWISTING_FANGS]: {
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 180 + index * 180, coefficient: 0.63 / 2 })),
        name: 'Twisting Fangs',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 2, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: false
  },
  [ID.CLOAK_AND_DAGGER]: {
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.6 }],
        name: 'Cloak and Dagger',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 5, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
});
