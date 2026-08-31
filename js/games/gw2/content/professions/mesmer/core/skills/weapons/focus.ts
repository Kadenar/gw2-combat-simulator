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
        coefficient: 1.656,
        hits: 12,
        name: 'Damage',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    quicknessCastTimeMs: 460
  }
});
