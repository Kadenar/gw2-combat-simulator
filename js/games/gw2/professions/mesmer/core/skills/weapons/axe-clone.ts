import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Axe clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const axeCloneAttack = {
  weaponStrength: 28.5,
  id: ID.LACERATING_CHOP,
  name: 'Clone: Lacerating Chop',
  coefficient: 0.55,
  hits: 1,
  firstAttackDelay: 1.2,
  damageAtMs: 520,
  interval: 1.56,
  conditions: [
    {
      type: 'condition',
      condition: 'Bleeding',
      duration: 1,
      stacks: 1
    },
    {
      type: 'condition',
      condition: 'Torment',
      duration: 1,
      stacks: 1
    }
  ]
} satisfies MesmerCloneAttack;
