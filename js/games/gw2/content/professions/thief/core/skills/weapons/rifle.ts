/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEATHS_ADVANCE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.KNEEL]: {
    implemented: true,
    // Custom: Enters Kneel and exposes kneeling rifle skills; see `core/skills/actions.ts`.
    handlerId: 'thief.kneel',
    castTimeMs: 500,
    cooldown: 0.5,
    initiativeCost: 1,
    effects: []
  },
  [ID.DEADLY_AIM]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.1 }],
        name: 'Deadly Aim',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 2, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    kneelSkill: true
  },
  [ID.FREE_ACTION]: {
    implemented: true,
    // Custom: Leaves Kneel and restores standing rifle skills; see `core/skills/actions.ts`.
    handlerId: 'thief.free-action',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.BRUTAL_AIM]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.75 }],
        name: 'Brutal Aim',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SKIRMISHERS_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: "Skirmisher's Shot",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.DEATHS_RETREAT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.3 }],
        name: "Death's Retreat",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 1, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DOUBLE_TAP]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 260 + index * 260, coefficient: 2.8 / 2 })),
        name: 'Double Tap',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.SPOTTERS_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.3 }],
        name: "Spotter's Shot",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.THREE_ROUND_BURST]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 222 + index * 222, coefficient: 2.25 / 3 })),
        name: 'Three Round Burst',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ],
    kneelSkill: true
  },
  [ID.SNIPERS_COVER]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [],
    kneelSkill: true
  },
  [ID.DEATHS_JUDGMENT]: {
    implemented: true,
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 500,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.67 }],
        name: "Death's Judgment — Packet 1",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.32 }],
        name: 'Damage on Unmarked Foes',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Rifle',
    stealthAttack: true
  }
});
