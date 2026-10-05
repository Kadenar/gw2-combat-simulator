import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Spear clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const spearCloneAttack = {
  weaponStrength: 26.3,
  sequence: [
    {
      id: ID.PSYCUT,
      name: 'Clone: Psycut',
      coefficient: 1,
      hits: 1,
      interval: 0.6
    },
    {
      id: ID.PSYSTRIKE,
      name: 'Clone: Psystrike',
      coefficient: 1,
      hits: 1,
      interval: 0.78
    },
    {
      id: ID.MIND_PIERCE,
      name: 'Clone: Mind Pierce',
      coefficient: 1.5,
      hits: 1,
      interval: 0.84
    }
  ]
} satisfies MesmerCloneAttack;
