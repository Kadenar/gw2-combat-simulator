import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Dagger clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const daggerCloneAttack = {
  id: ID.FLYING_CUTTER,
  name: 'Clone: Flying Cutter',
  coefficient: 0.5,
  hits: 1,
  firstAttackDelay: 1.16,
  interval: 1.6,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;
