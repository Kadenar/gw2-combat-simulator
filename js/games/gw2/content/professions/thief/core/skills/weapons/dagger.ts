/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DOUBLE_STRIKE]: {
    implemented: true,
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
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 320,
    interruptCommitMs: 200,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Front damage',
        actorType: 'player',
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true
  },
  [ID.DEATH_BLOSSOM]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Dancing Dagger',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SHADOW_SHOT]: {
    implemented: true,
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Shadow Shot',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 5
        }
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Pistol'
  },
  [ID.WILD_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    // Wild Strike commits its strike and bleeding on the ~160 ms impact before the chain animation ends.
    interruptCommitMs: 160,
    cooldown: 0,
    initiativeCost: 0,
    resourceGain: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Wild Strike',
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 3,
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.HEARTSEEKER]: {
    implemented: true,
    movementSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
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
        ]
      }
    ]
  },
  [ID.LOTUS_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Lotus Strike',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TWISTING_FANGS]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.63,
        hits: 2,
        name: 'Twisting Fangs',
        actorType: 'player',
        atMs: 180,
        intervalMs: 180,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: false
  },
  [ID.CLOAK_AND_DAGGER]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Cloak and Dagger',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  }
});
