/**
 * Owns Mechanist autonomous, triggered, and supplemental mech attack identities.
 * User-issued mech commands and their cast-lane rules live in `mech-command-skills.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies non-command mech attack fragments to specialization composition. */
export const MECHANIST_MECH_ATTACK_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.AERIAL_SUPPORT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aerial Support',
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_PUNCH_MECH]: {
    castTimeMs: 500,
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Punch (Mech)',
        actorType: 'summon',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'defiance',
        duration: 100
      }
    ]
  },
  [ID.HEAVY_SMASH_MECH]: {
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Heavy Smash (Mech)',
        actorType: 'summon'
      }
    ]
  },
  [ID.JADE_ENERGY_SHOT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.TWIN_STRIKE_MECH]: {
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 180 + index * 180, coefficient: 0.8 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Twin Strike (Mech)',
        actorType: 'summon'
      }
    ]
  },
  [ID.HARD_STRIKE]: {
    castTimeMs: 250,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Hard Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.JADE_ENERGY_SHOT_ID_63348]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.JADE_BUSTER_CANNON]: {
    simulatorExcluded: true,
    castTimeMs: 3250,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 440 + index * 440, coefficient: 4.75 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Jade Buster Cannon',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 440 + index * 440,
          condition: 'Burning',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'summon'
      }
    ],
    toolbeltParentName: 'Overclock Signet'
  },
  [ID.MECH_SUPPORT_DEPTH_CHARGES]: {
    castTimeMs: 500,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Mech Support: Depth Charges',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 4
  }
});
