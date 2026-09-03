/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JUSTICE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.COURAGE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RESOLVE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  }
});
