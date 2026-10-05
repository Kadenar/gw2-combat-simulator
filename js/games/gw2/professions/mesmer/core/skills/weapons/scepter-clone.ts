import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Scepter clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const scepterCloneAttack = {
  id: ID.ETHER_BOLT,
  name: 'Clone: Ether Bolt',
  coefficient: 0.5,
  hits: 1,
  interval: 2,
  weaponStrength: 34,
  conditions: [
    {
      type: 'condition',
      condition: 'Torment',
      duration: 4,
      stacks: 1
    }
  ]
} satisfies MesmerCloneAttack;
