/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_DUELIST]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Pistol',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 16,
    phantasm: true,
    // Weapon-swap cancellation does not shorten Duelist's cast lane, so replay must not add the same aftercast as idle time.
    retainsCastLockoutAfterInterrupt: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 350,
            coefficient: 0.33
          },
          {
            atMs: 350,
            coefficient: 0.33
          },
          {
            atMs: 400,
            coefficient: 0.33
          }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'pistol',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0.92,
        hits: 8,
        name: 'Illusion Damage',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      },
      {
        type: 'condition',
        condition: 'bleeding',
        duration: 4,
        stacks: 8,
        actorType: 'summon',
        summonKind: 'phantasm',
        packetLabel: 'Illusion Damage'
      }
    ],
    castTimeMs: 840
  },
  [ID.MAGIC_BULLET]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Pistol',
    specialization: '',
    environment: 'Terrestrial',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 362, coefficient: 0.2 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'pistol',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 5,
        stacks: 3
      }
    ],
    castTimeMs: 660
  }
});
