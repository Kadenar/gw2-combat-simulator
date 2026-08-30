/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_BLADES]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 3.25,
        hits: 5,
        atMs: 250,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.SWORD_OF_WRATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      }
    ]
  },
  [ID.SWORD_ARC]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.ZEALOTS_DEFENSE]: {
    implemented: true,
    castTimeMs: 3000,
    effects: [
      {
        type: 'strike',
        coefficient: 4.8,
        hits: 8,
        atMs: 250,
        intervalMs: 250,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SWORD_WAVE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 3
      }
    ]
  },
  [ID.EXECUTIONERS_CALLING]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 4,
        name: "Executioner's Calling — Secondary Attacks"
      }
    ]
  },
  [ID.ADVANCING_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 2
      }
    ]
  }
});
