/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.THE_PRESTIGE]: {
    rechargeAnchor: 'castStart',
    // Prestige commits before its recovery ends; newly added casts stop at commitment.
    castTimeMs: 160,
    defaultInterruptMs: 40,
    interruptCommitMs: 40,
    effects: [
      // Blind on activation; the later burning explosion performs the blast finisher.
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'Player',
        actorType: ACTOR.PLAYER
      },
      ...impactEffects({ atMs: 3000, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          // The committed explosion and its burning survive cancellation of the recovery animation.
          persistsAfterInterrupt: true,
          comboFinishers: [{ ownerId: 'mesmer', finisherType: COMBO_FINISHER.BLAST }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.TORCH.toLowerCase()
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 9, persistsAfterInterrupt: true }
      ])
    ]
  },
  [ID.PHANTASMAL_MAGE]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 2000,
      spawnAtMs: 2240
    },
    phantasm: true,
    phantasmSummonProgress: 560 / 760,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 760,
    // The mage has already spawned before the aftercast ends, so a later cancellation retains its clone conversion.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 0.19,
        hits: 1,
        name: 'Mesmer attack',
        actorType: ACTOR.PLAYER,
        // The player's opening burst lands at commitment, before the phantasm cast's recovery finishes.
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
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
        actorType: ACTOR.PLAYER,
        // Keep the initial burning on the same impact as the player's strike.
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
      },
      {
        // Backfire's daze follows its conditions and can activate disable reactions such as Akeem.
        type: 'control',
        controlKind: CONTROL.DAZE,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  }
});
