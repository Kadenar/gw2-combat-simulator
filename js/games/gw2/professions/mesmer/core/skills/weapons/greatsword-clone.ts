import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Greatsword clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const greatswordCloneAttack = {
  id: ID.SPATIAL_SURGE,
  firstAttackDelay: 1.14,
  ticks: [
    { atMs: 520, coefficient: 0.8 / 3 },
    { atMs: 760, coefficient: 0.8 / 3 },
    { atMs: 1000, coefficient: 0.8 / 3 }
  ],
  interval: 3.44,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;
