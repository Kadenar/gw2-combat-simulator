/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BOLA_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Bola Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      }
    ]
  },
  [ID.SHADOW_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.315,
        hits: 1,
        name: 'Shadow Strike — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.3125,
        hits: 1,
        name: 'Shot Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 6,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  },
  [ID.UNLOAD]: {
    implemented: true,
    quicknessCastTimeMs: 1320,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 3.36,
        hits: 8,
        name: 'Unload',
        actorType: 'player',
        atMs: 96.666666666667,
        intervalMs: 96.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 8
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Pistol'
  },
  [ID.HEAD_SHOT]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Head Shot',
        actorType: 'player'
      }
    ]
  },
  [ID.VITAL_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.575,
        hits: 1,
        name: 'Vital Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.REPEATER]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        name: 'Repeater (offhand empty)',
        actorType: 'player',
        atMs: 168,
        intervalMs: 168,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: false
  },
  [ID.BLACK_POWDER]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 3,
        name: 'Black Powder',
        actorType: 'player',
        atMs: 120.24,
        intervalMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        actorType: 'player',
        applications: 3,
        atMs: 0,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SNEAK_ATTACK]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 1000,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 5,
        name: 'Sneak Attack',
        actorType: 'player',
        atMs: 136,
        intervalMs: 136,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    stealthAttack: true
  },
  [ID.REPEATER_ID_59526]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 7.5,
        hits: 5,
        name: 'Repeater',
        actorType: 'player',
        atMs: 168,
        intervalMs: 168,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  }
});
