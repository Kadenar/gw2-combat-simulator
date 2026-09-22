/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BOLT_OF_WRATH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1
      }
    ]
  },
  [ID.HOLY_STRIKE]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_SWIFTNESS]: {
    castTimeMs: 520,
    // The symbol creates its four-second Light field when the cast completes.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startAnchor: 'castEnd' }],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 0
      }
    ]
  },
  [ID.LINE_OF_WARDING]: {
    castTimeMs: 520,
    effects: []
  },
  [ID.EMPOWER]: {
    castTimeMs: 520,
    effects: []
  },
  [ID.SEEKING_JUDGMENT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      }
    ]
  },
  [ID.SEARING_LIGHT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      }
    ]
  }
});
