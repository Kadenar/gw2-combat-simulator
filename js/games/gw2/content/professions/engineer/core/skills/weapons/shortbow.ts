/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer shortbow essence and detonation skill effects. */
export const ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ESSENCE_OF_LIQUID_WRATH]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1,
        name: 'Essence of Liquid Wrath',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ARC_DETONATOR]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Arc Detonator — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Shock Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_OF_LIVING_SHADOWS]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 645 }, (_, index) => ({
          atMs: 0.693333333333 + index * 0.693333333333,
          coefficient: 1.0
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Essence of Living Shadows',
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_OF_BORROWED_TIME]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Essence of Borrowed Time',
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
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.ESSENCE_OF_ANIMATED_SAND]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Essence of Animated Sand',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3
      }
    ]
  }
});
