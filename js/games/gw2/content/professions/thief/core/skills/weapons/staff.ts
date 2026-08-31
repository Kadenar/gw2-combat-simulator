/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WEAKENING_WHIRL]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 3,
        name: 'Weakening Whirl',
        actorType: 'player',
        atMs: 111.333333333333,
        intervalMs: 111.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.STAFF_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Staff Bash',
        actorType: 'player'
      }
    ]
  },
  [ID.HOOK_STRIKE]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 640,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Hook Strike',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 4
        }
      }
    ],
    requiredMainHand: 'Staff',
    stealthAttack: true
  },
  [ID.PUNISHING_STRIKES]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 760,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.1,
        hits: 4,
        name: 'Punishing Strikes',
        actorType: 'player',
        atMs: 166.666666666667,
        intervalMs: 166.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.DEBILITATING_ARC]: {
    implemented: true,
    quicknessCastTimeMs: 200,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Debilitating Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.VAULT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Vault',
        actorType: 'player'
      }
    ]
  },
  [ID.STAFF_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Staff Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.DUST_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 3,
        name: 'Dust Strike',
        actorType: 'player',
        atMs: 173.333333333333,
        intervalMs: 173.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 1
        }
      }
    ]
  },
  [ID.HELMET_BREAKER]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Helmet Breaker',
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
  }
});
