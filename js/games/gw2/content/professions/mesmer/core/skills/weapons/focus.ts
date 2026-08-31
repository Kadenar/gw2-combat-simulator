/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TEMPORAL_CURTAIN]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Focus',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 740,
    cooldown: 25,
    effects: []
  },
  [ID.PHANTASMAL_WARDEN]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Focus',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 20,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 880, coefficient: 0.138 },
          { atMs: 1240, coefficient: 0.138 },
          { atMs: 1600, coefficient: 0.138 },
          { atMs: 1960, coefficient: 0.138 },
          { atMs: 2320, coefficient: 0.138 },
          { atMs: 2680, coefficient: 0.138 },
          { atMs: 3080, coefficient: 0.138 },
          { atMs: 3440, coefficient: 0.138 },
          { atMs: 3800, coefficient: 0.138 },
          { atMs: 4160, coefficient: 0.138 },
          { atMs: 4520, coefficient: 0.138 },
          { atMs: 4880, coefficient: 0.138 }
        ],
        name: 'Damage',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    quicknessCastTimeMs: 460
  }
});
