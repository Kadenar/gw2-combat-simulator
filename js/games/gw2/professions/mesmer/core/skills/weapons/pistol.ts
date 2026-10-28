/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.PHANTASMAL_DUELIST]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 2240,
      // Measured packet and conversion offsets stay anchored to the observed cast end.
      spawnAtMs: 2800,
      phantasmalBladeDelayAfterSpawnMs: 175
    },
    phantasm: true,
    phantasmSummonProgress: 360 / 560,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 560,
    // Cancelling after commitment preserves the Duelist's attacks and clone conversion while retaining its cast lockout.
    interruptCommitMs: 360,
    // Weapon-swap cancellation does not shorten Duelist's cast lane, so replay must not add the same aftercast as idle time.
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.33
          },
          {
            atMs: 360,
            coefficient: 0.33
          },
          {
            atMs: 400,
            coefficient: 0.33
          }
        ],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.PISTOL.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 840, coefficient: 0.115 },
          { atMs: 1040, coefficient: 0.115 },
          { atMs: 1240, coefficient: 0.115 },
          { atMs: 1440, coefficient: 0.115 },
          { atMs: 1640, coefficient: 0.115 },
          { atMs: 1840, coefficient: 0.115 },
          { atMs: 2040, coefficient: 0.115 },
          { atMs: 2240, coefficient: 0.115 }
        ],
        name: 'Illusion Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        duration: 4,
        stacks: 8,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        packetLabel: 'Illusion Damage'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.MAGIC_BULLET]: {
    castTimeMs: 440,
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
        ticks: [{ atMs: 360, coefficient: 0.2 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.PISTOL.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 5,
        stacks: 3
      }
    ]
  }
});
