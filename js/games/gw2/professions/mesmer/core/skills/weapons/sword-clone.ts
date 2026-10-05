import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Sword clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const swordCloneAttack = {
  weaponStrength: 20.5,
  firstAttackDelay: 2.48,
  sequence: [
    {
      id: ID.MIND_SLASH,
      name: 'Clone: Mind Slash',
      coefficient: 0.75,
      hits: 1,
      interval: 0.8266666666666667
    },
    {
      id: ID.MIND_GASH,
      name: 'Clone: Mind Gash',
      coefficient: 0.75,
      hits: 1,
      interval: 0.8266666666666667
    },
    {
      id: ID.MIND_STAB,
      name: 'Clone: Mind Stab',
      coefficient: 0.12,
      hits: 1,
      interval: 0.8266666666666667
    }
  ]
} satisfies MesmerCloneAttack;
