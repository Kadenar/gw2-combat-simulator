/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FRIENDLY_FIRE]: {
    type: 'Weapon',
    weapon: 'Rifle',
    specialization: '',
    quicknessCastTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.JOURNEY]: {
    type: 'Weapon',
    weapon: 'Rifle',
    specialization: '',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.INSPIRING_IMAGERY]: {
    type: 'Weapon',
    weapon: 'Rifle',
    specialization: '',
    quicknessCastTimeMs: 500,
    cooldown: 12,
    effects: []
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    type: 'Weapon',
    weapon: 'Rifle',
    specialization: '',
    quicknessCastTimeMs: 500,
    cooldown: 20,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 2.28,
        hits: 1,
        name: 'Phantasm shot',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'rifle'
      }
    ]
  },
  [ID.SINGULARITY_SHOT]: {
    type: 'Weapon',
    weapon: 'Rifle',
    specialization: '',
    quicknessCastTimeMs: 333.333333333,
    cooldown: 20,
    effects: []
  }
});
