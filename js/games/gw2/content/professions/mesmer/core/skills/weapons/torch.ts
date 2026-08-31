/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_MAGE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Torch',
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
        duration: 3,
        stacks: 2,
        actorType: 'player',
        requiredTrait: TRAIT.THE_PLEDGE
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
    quicknessCastTimeMs: 760
  },
  [ID.THE_PRESTIGE]: {
    implemented: true,
    type: 'Weapon',
    weapon: 'Torch',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 40,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 1 }],
        timingAnchor: 'castStart',
        name: 'Damage',
        actorType: 'player',
        weapon: 'torch'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3000, condition: 'Burning', stacks: 1, duration: 9 }],
        timingAnchor: 'castStart'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3000, condition: 'Burning', stacks: 2, duration: 3 }],
        timingAnchor: 'castStart',
        requiredTrait: TRAIT.THE_PLEDGE
      }
    ]
  }
});
