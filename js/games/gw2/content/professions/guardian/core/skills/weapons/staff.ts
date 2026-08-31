/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BOLT_OF_WRATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1
      }
    ]
  },
  [ID.HOLY_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_SWIFTNESS]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5
      }
    ]
  },
  [ID.LINE_OF_WARDING]: {
    implemented: true,
    castTimeMs: 750,
    effects: []
  },
  [ID.EMPOWER]: {
    implemented: true,
    castTimeMs: 750,
    effects: []
  },
  [ID.SEEKING_JUDGMENT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      }
    ]
  },
  [ID.SEARING_LIGHT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      }
    ]
  }
});
