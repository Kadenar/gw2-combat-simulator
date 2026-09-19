/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_MAGE]: {
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
        actorType: 'player',
        weapon: 'torch'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Phantasm attack',
        actorType: 'summon',
        summonKind: 'phantasm',
        // Backfire uses the phantasm's summon profile rather than the mesmer's equipped Torch strength.
        weapon: 'Phantasm medium'
      },
      {
        type: 'condition',
        condition: 'Burning',
        duration: 6,
        stacks: 1,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        duration: 9,
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 3,
        stacks: 3,
        actorType: 'summon',
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
      { type: 'blind', duration: 5, source: 'Player', actorType: 'player' },
      ...impactEffects({ atMs: 3000, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          comboFinishers: [{ ownerId: 'mesmer', finisherType: 'Blast' }],
          name: 'Damage',
          actorType: 'player',
          weapon: 'torch'
        },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 9 }
      ])
    ]
  }
});
