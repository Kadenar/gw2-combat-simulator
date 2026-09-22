/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const MESMER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CRY_OF_FRUSTRATION]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.MIND_WRACK]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.DISTORTION]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.DIVERSION]: {
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    // The shatter owns its control effect rather than relying on the core CC skill list.
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
});
