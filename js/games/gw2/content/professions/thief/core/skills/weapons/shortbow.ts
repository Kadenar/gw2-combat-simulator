/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TRICK_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Trick Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.CHOKING_GAS]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 4,
        name: 'Choking Gas',
        actorType: 'player',
        atMs: 90,
        intervalMs: 90,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.INFILTRATORS_ARROW]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.CLUSTER_BOMB]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Large Explosion',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_CLUSTER]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 4,
        name: 'Small Explosion',
        actorType: 'player',
        atMs: 170,
        intervalMs: 170,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.DISABLING_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Disabling Shot (thief short bow skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.SURPRISE_SHOT]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 250,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Surprise Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Shortbow',
    stealthAttack: true
  }
});
