/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHIELD_OF_WRATH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 4000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RAY_OF_JUDGMENT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 4.05,
        hits: 6,
        atMs: 750,
        intervalMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind'
      }
    ]
  }
});
