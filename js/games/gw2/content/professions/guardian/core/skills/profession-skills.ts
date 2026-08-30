/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.VIRTUE_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.VIRTUE_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  }
});
