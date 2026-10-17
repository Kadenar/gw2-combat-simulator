import { WEAPON, ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

export const MESMER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.PHANTASMAL_MAGE]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 2000,
      spawnAtMs: 2240
    },
    phantasm: true,
    // The mage has already spawned before the aftercast ends, so a later cancellation retains its clone conversion.
    interruptCommitMs: 560,
    phantasmSummonProgress: 560 / 760,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.19,
        hits: 1,
        name: 'Mesmer attack',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.TORCH.toLowerCase()
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Phantasm attack',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        // Backfire uses the phantasm's summon profile rather than the mesmer's equipped Torch strength.
        weapon: 'Phantasm medium'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        duration: 6,
        stacks: 1,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        duration: 9,
        stacks: 1,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 3,
        stacks: 3,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm'
      }
    ],
    castTimeMs: 760
  },
  [ID.THE_PRESTIGE]: {
    castTimeMs: 40,
    rechargeAnchor: 'castStart',
    effects: [
      // Blind on activation; the later burning explosion performs the blast finisher.
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        source: 'Player',
        actorType: ACTOR.PLAYER
      },
      ...impactEffects({ atMs: 3000, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          comboFinishers: [{ ownerId: 'mesmer', finisherType: COMBO_FINISHER.BLAST }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.TORCH.toLowerCase()
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 9 }
      ])
    ]
  }
});
