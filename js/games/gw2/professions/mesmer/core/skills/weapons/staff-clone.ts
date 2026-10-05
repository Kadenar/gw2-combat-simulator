import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Staff clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const staffCloneAttack = {
  id: ID.WINDS_OF_CHAOS,
  name: 'Clone: Winds of Chaos',
  coefficient: 0.49,
  hits: 2,
  atMs: 0,
  // Delay the first impact to include clone startup and projectile travel observed in combat logs.
  firstAttackDelay: 1.96,
  interval: 2.24,
  weaponStrength: 26,
  conditions: [
    {
      type: 'condition',
      condition: 'Torment',
      duration: 2,
      stacks: 1
    },
    {
      type: 'condition',
      condition: 'Confusion',
      duration: 2,
      stacks: 1
    }
  ]
} satisfies MesmerCloneAttack;
