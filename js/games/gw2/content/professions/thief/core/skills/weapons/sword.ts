/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LARCENOUS_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.17,
        hits: 1,
        name: 'Larcenous Strike',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
  },
  [ID.SLICE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Slice (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.INFILTRATORS_STRIKE]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: "Infiltrator's Strike",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.FLANKING_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Flanking Strike',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
  },
  [ID.SLASH]: {
    implemented: true,
    castTimeMs: 625,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Slash (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.STAB]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Stab (thief sword skill)',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: false
  },
  [ID.TACTICAL_STRIKE]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 525,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Tactical Strike',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    stealthAttack: true
  },
  [ID.CRIPPLING_STRIKE]: {
    implemented: true,
    castTimeMs: 775,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1,
        name: 'Crippling Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.INFILTRATORS_RETURN]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: []
  },
  [ID.FLAWLESS_EXECUTION]: {
    implemented: true,
    interruptMode: 'per-packet',
    castTimeMs: 2100,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400.3, coefficient: 0.53 },
          { atMs: 559.7, coefficient: 0.53 },
          { atMs: 718.9, coefficient: 0.53 }
        ],
        name: 'Flawless Execution — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Final Slash Damage',
        actorType: 'player',
        atMs: 1240.4,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 320.4, coefficient: 0.25 },
          { atMs: 439.7, coefficient: 0.25 },
          { atMs: 519.2, coefficient: 0.25 },
          { atMs: 640.2, coefficient: 0.25 },
          { atMs: 760.1, coefficient: 0.25 },
          { atMs: 840.5, coefficient: 0.25 }
        ],
        name: 'Projectile Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Pistol'
  }
});
