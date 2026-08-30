/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PROTECTORS_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.FAITHFUL_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1
      }
    ]
  },
  [ID.TRUE_STRIKE]: {
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
  [ID.PURE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_FAITH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 3.25,
        hits: 5,
        atMs: 750,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
