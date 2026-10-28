/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, WEAPON } from '#gw2/platform/constants.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.ECHO_OF_MEMORY]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 1440,
      spawnAtMs: 2160
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 1640,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.TIDES_OF_TIME]: {
    castTimeMs: 680,
    effects: [
      // Preserve this skill's existing cast-completion CC timing in its own definition.
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SHIELD.toLowerCase()
      }
    ]
  }
});
