/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHADOW_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Shadow Bolt',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.ENDLESS_NIGHT]: {
    implemented: true,
    quicknessCastTimeMs: 1920,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.31,
        hits: 7,
        name: 'Endless Night',
        actorType: 'player',
        atMs: 274.285714285714,
        intervalMs: 274.285714285714,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        atMs: 274.285714285714,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 274.285714285714,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 548.571428571429,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 822.857142857143,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1097.142857142857,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1371.428571428571,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1645.714285714285,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          { atMs: 1920, condition: 'Torment', stacks: 1, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.TRIPLE_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 1080,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 1040,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 320, condition: 'Torment', stacks: 1, duration: 5 },
          { atMs: 640, condition: 'Torment', stacks: 1, duration: 5 },
          { atMs: 1040, condition: 'Torment', stacks: 1, duration: 5 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TRIPLE_THREAT]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.35,
        hits: 3,
        name: 'Triple Threat',
        actorType: 'player',
        atMs: 333.333333333333,
        intervalMs: 333.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 333.333333333333, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 666.666666666667, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 1000, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: false
  },
  [ID.DOUBLE_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Double Bolt',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Double Bolt',
        actorType: 'player',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 320, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TWILIGHT_COMBO]: {
    implemented: true,
    quicknessCastTimeMs: 760,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Initial Attack',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Secondary Attack',
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 5,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Dagger'
  },
  [ID.MEASURED_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Measured Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    movementSkill: true,
    shadowstepSkill: true,
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.SHADOWSQUALL]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 1960,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 8,
        name: 'Shadowsquall',
        actorType: 'player',
        atMs: 245,
        intervalMs: 245,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 245, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 490, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 735, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 980, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1225, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1470, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1715, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1960, condition: 'Poisoned', stacks: 1, duration: 3 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    stealthAttack: true
  },
  [ID.SHADOW_SAP]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Shadow Sap',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  }
});
