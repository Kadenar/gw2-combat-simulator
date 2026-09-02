/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CRY_OF_FRUSTRATION]: {
    type: 'Profession',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 25,
    effects: []
  },
  [ID.MIND_WRACK]: {
    type: 'Profession',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 12,
    effects: []
  },
  [ID.DISTORTION]: {
    type: 'Profession',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 50,
    effects: []
  },
  [ID.DIVERSION]: {
    type: 'Profession',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    cooldown: 38,
    effects: []
  }
});
