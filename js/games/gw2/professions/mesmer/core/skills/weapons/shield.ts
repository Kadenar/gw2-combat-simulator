/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.TIDES_OF_TIME]: {
    castTimeMs: 680,
    effects: [
      // Preserve this skill's existing cast-completion CC timing in its own definition.
      {
        type: 'control',
        source: 'Player',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
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
    castTimeMs: 1640
  }
});
