/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_BLADES]: {
    castTimeMs: 250,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 250, startAnchor: 'castStart' }],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 250 + index * 1000, coefficient: 3.25 / 5 })),
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
    castTimeMs: 3000,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 250 + index * 250, coefficient: 4.8 / 8 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SWORD_WAVE]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 3,
        atMs: 0
      }
    ]
  },
  [ID.EXECUTIONERS_CALLING]: {
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
        atMs: 0,
        name: "Executioner's Calling — Secondary Attacks"
      }
    ]
  },
  [ID.ADVANCING_STRIKE]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 2,
        atMs: 0
      }
    ]
  }
});
