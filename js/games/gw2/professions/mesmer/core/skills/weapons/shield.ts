/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TIDES_OF_TIME]: {
    type: 'Weapon',
    weapon: 'Shield',
    specialization: 'Chronomancer',
    castTimeMs: 1020,
    cooldown: 35,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'shield'
      }
    ]
  },
  [ID.ECHO_OF_MEMORY]: {
    type: 'Weapon',
    weapon: 'Shield',
    specialization: 'Chronomancer',
    cooldown: 30,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Damage',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 2460
  }
});
